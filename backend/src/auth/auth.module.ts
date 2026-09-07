import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { GoogleOidcService } from './google-oidc.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthConfig,
    AuthService,
    GoogleOidcService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
