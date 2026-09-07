import { newToken, readTokenCookie, tokenHash } from './auth.tokens';
import { AuthConfig } from './auth.config';

describe('Session boundary', () => {
  it('accepts only one correctly formed token cookie', () => {
    const token = newToken();
    expect(token).toHaveLength(43);
    expect(tokenHash(token)).toHaveLength(64);
    expect(
      readTokenCookie(`other=x; reelink_session=${token}`, 'reelink_session'),
    ).toBe(token);
    for (const value of [
      undefined,
      'reelink_session=x',
      `reelink_session=${token}; reelink_session=${token}`,
      'reelink_session=%ZZ',
    ]) {
      expect(readTokenCookie(value, 'reelink_session')).toBeUndefined();
    }
  });

  it('requires HTTPS and host-only secure cookies in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalOrigin = process.env.APP_ORIGIN;
    try {
      process.env.NODE_ENV = 'production';
      process.env.APP_ORIGIN = 'http://localhost:3000';
      expect(() => new AuthConfig()).toThrow('HTTPS');
      process.env.APP_ORIGIN = 'https://reelink.example';
      const config = new AuthConfig();
      expect(config.sessionCookie).toBe('__Host-reelink_session');
      expect(config.cookieOptions).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = originalOrigin;
    }
  });
});
