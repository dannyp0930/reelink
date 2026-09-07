import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthConfig } from './auth.config';
import { AuthService } from './auth.service';
import { Public } from './auth.metadata';
import type { AuthenticatedRequest } from './auth.metadata';
import { readTokenCookie } from './auth.tokens';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AuthConfig,
  ) {}

  @Public()
  @Get('session')
  session(@Req() request: AuthenticatedRequest) {
    return { user: request.user, googleAvailable: this.config.googleAvailable };
  }

  @Public()
  @Get('google')
  async google(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    if (!this.config.googleAvailable)
      return response.redirect(303, `${this.config.origin}/?auth=unavailable`);
    const login = await this.auth.begin(
      readTokenCookie(request.headers.cookie, this.config.loginCookie),
    );
    response.cookie(this.config.loginCookie, login.binding, {
      ...this.config.cookieOptions,
      maxAge: this.config.loginDuration,
    });
    return response.redirect(303, login.url);
  }

  @Public()
  @Get('google/callback')
  async callback(
    @Query('state') state: unknown,
    @Query('code') code: unknown,
    @Query('error') error: unknown,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    response.setHeader('Referrer-Policy', 'no-referrer');
    const binding = readTokenCookie(
      request.headers.cookie,
      this.config.loginCookie,
    );
    response.clearCookie(this.config.loginCookie, this.config.cookieOptions);
    try {
      if (error !== undefined) throw new Error('Provider denied login');
      const session = await this.auth.finish(
        state,
        code,
        binding,
        readTokenCookie(request.headers.cookie, this.config.sessionCookie),
      );
      response.cookie(this.config.sessionCookie, session.token, {
        ...this.config.cookieOptions,
        expires: session.expiresAt,
      });
      return response.redirect(303, `${this.config.origin}/`);
    } catch {
      return response.redirect(303, `${this.config.origin}/?auth=failed`);
    }
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    await this.auth.logout(
      readTokenCookie(request.headers.cookie, this.config.sessionCookie),
    );
    response.clearCookie(this.config.sessionCookie, this.config.cookieOptions);
    response.clearCookie(this.config.loginCookie, this.config.cookieOptions);
    return response.redirect(303, `${this.config.origin}/`);
  }
}
