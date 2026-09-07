import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { UserRole } from '../generated/prisma/enums';
import { AuthConfig } from './auth.config';
import { AuthService } from './auth.service';
import { readTokenCookie } from './auth.tokens';

import type { AuthenticatedRequest } from './auth.metadata';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly config: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    response.vary('Cookie');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      request.headers.origin !== this.config.origin
    ) {
      throw new ForbiddenException('Request origin is not allowed');
    }
    request.user = await this.auth.userForSession(
      readTokenCookie(request.headers.cookie, this.config.sessionCookie),
    );
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('auth:public', targets))
      return true;
    if (!request.user) throw new UnauthorizedException();
    const roles = this.reflector.getAllAndOverride<UserRole[]>(
      'auth:roles',
      targets,
    );
    if (roles && !roles.includes(request.user.role))
      throw new ForbiddenException();
    return true;
  }
}
