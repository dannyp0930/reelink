import 'dotenv/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthConfig {
  readonly origin: string;
  readonly secure: boolean;
  readonly sessionCookie: string;
  readonly loginCookie: string;
  readonly clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  readonly sessionDuration = 7 * 24 * 60 * 60 * 1000;
  readonly loginDuration = 10 * 60 * 1000;

  constructor() {
    const url = new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000');
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      (url.protocol !== 'https:' &&
        !(
          process.env.NODE_ENV !== 'production' &&
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)
        ))
    )
      throw new Error(
        'APP_ORIGIN must be an HTTPS origin (local HTTP is development-only)',
      );
    this.origin = url.origin;
    this.secure = url.protocol === 'https:';
    this.sessionCookie = this.secure
      ? '__Host-reelink_session'
      : 'reelink_session';
    this.loginCookie = this.secure ? '__Host-reelink_login' : 'reelink_login';
  }

  get googleAvailable() {
    return Boolean(this.clientId && this.clientSecret);
  }
  get callbackUrl() {
    return `${this.origin}/api/auth/google/callback`;
  }
  get cookieOptions() {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
