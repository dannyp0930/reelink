import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { createHash } from 'node:crypto';
import { AuthConfig } from './auth.config';

@Injectable()
export class GoogleOidcService {
  private readonly client: OAuth2Client;

  constructor(private readonly config: AuthConfig) {
    this.client = new OAuth2Client({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.callbackUrl,
      transporterOptions: { timeout: 10000, retry: false },
    });
  }

  authorizationUrl(state: string, nonce: string, verifier: string) {
    if (!this.config.googleAvailable)
      throw new ServiceUnavailableException('Google login is not configured');
    return this.client.generateAuthUrl({
      scope: ['openid', 'email'],
      access_type: 'online',
      prompt: 'select_account',
      state,
      nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: CodeChallengeMethod.S256,
    });
  }

  async verify(code: string, verifier: string, nonce: string) {
    if (!this.config.googleAvailable)
      throw new ServiceUnavailableException('Google login is not configured');
    try {
      const { tokens } = await this.client.getToken({
        code,
        codeVerifier: verifier,
        redirect_uri: this.config.callbackUrl,
      });
      if (!tokens.id_token) throw new Error('Missing ID token');
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.config.clientId,
      });
      const payload = ticket.getPayload();
      // Signature, audience, issuer and expiry are checked by Google's library.
      if (
        !payload ||
        !payload.sub ||
        !payload.email ||
        payload.email_verified !== true ||
        !('nonce' in payload) ||
        payload.nonce !== nonce
      ) {
        throw new Error('Invalid identity claims');
      }
      return { subject: payload.sub, email: payload.email.toLowerCase() };
    } catch {
      // Provider errors can include tokens or client secrets; never log/return them.
      throw new UnauthorizedException('Google identity verification failed');
    }
  }
}
