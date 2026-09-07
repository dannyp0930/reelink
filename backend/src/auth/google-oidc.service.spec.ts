import { createSign, generateKeyPairSync } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import type { GetTokenOptions } from 'google-auth-library';
type CertificateFormat = Awaited<
  ReturnType<OAuth2Client['getFederatedSignonCertsAsync']>
>['format'];
import { AuthConfig } from './auth.config';
import { GoogleOidcService } from './google-oidc.service';

// Narrow Google's overloaded method to the Promise API used by our service.
function mockExchange() {
  return jest.spyOn(
    OAuth2Client.prototype,
    'getToken',
  ) as unknown as jest.SpyInstance<
    Promise<{ tokens: { id_token?: string }; res: null }>,
    [GetTokenOptions]
  >;
}

describe('Google OIDC verification', () => {
  const config = Object.assign(new AuthConfig(), {
    clientId: 'test-client',
    clientSecret: 'test-secret',
  });
  const service = new GoogleOidcService(config);
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: 'https://accounts.google.com',
    aud: config.clientId,
    sub: 'google-user',
    email: 'user@example.test',
    email_verified: true,
    nonce: 'expected-nonce',
    iat: now,
    exp: now + 3600,
  };

  function jwt(payload: object, key = privateKey) {
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', kid: 'test-key' }),
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createSign('RSA-SHA256')
      .update(`${header}.${body}`)
      .sign(key, 'base64url');
    return `${header}.${body}.${signature}`;
  }

  beforeEach(() => {
    jest
      .spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync')
      .mockResolvedValue({
        certs: {
          'test-key': publicKey
            .export({ type: 'spki', format: 'pem' })
            .toString(),
        },
        format: 'PEM' as CertificateFormat,
      });
  });
  afterEach(() => jest.restoreAllMocks());

  it('verifies a signed token and sends PKCE verifier during exchange', async () => {
    const exchange = mockExchange().mockResolvedValue({
      tokens: { id_token: jwt(claims) },
      res: null,
    });
    await expect(
      service.verify('code', 'verifier', 'expected-nonce'),
    ).resolves.toEqual({ subject: claims.sub, email: claims.email });
    expect(exchange).toHaveBeenCalledWith({
      code: 'code',
      codeVerifier: 'verifier',
      redirect_uri: config.callbackUrl,
    });
  });

  it.each([
    { aud: 'other-client' },
    { iss: 'https://attacker.example' },
    { exp: now - 600 },
    { iat: now + 600 },
    { nonce: 'wrong' },
    { nonce: undefined },
    { email_verified: false },
    { email: undefined },
    { sub: '' },
  ])('rejects invalid identity claims %j', async (change) => {
    mockExchange().mockResolvedValue({
      tokens: { id_token: jwt({ ...claims, ...change }) },
      res: null,
    });
    await expect(
      service.verify('code', 'verifier', 'expected-nonce'),
    ).rejects.toThrow('Google identity verification failed');
  });

  it('rejects a forged signature', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    mockExchange().mockResolvedValue({
      tokens: { id_token: jwt(claims, other.privateKey) },
      res: null,
    });
    await expect(
      service.verify('code', 'verifier', 'expected-nonce'),
    ).rejects.toThrow('Google identity verification failed');
  });

  it('does not expose provider error details', async () => {
    mockExchange().mockRejectedValue(new Error('secret=do-not-return'));
    await expect(
      service.verify('code', 'verifier', 'expected-nonce'),
    ).rejects.toThrow('Google identity verification failed');
  });

  it('builds an authorization request with state, nonce and S256 PKCE', () => {
    const url = new URL(service.authorizationUrl('state', 'nonce', 'verifier'));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      scope: 'openid email',
      state: 'state',
      nonce: 'nonce',
      code_challenge_method: 'S256',
      redirect_uri: config.callbackUrl,
    });
    expect(url.searchParams.has('code_verifier')).toBe(false);
  });
});
