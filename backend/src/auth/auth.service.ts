import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthConfig } from './auth.config';
import { GoogleOidcService } from './google-oidc.service';
import { isToken, newToken, tokenHash } from './auth.tokens';

const userSelection = { id: true, email: true, role: true } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AuthConfig,
    private readonly google: GoogleOidcService,
  ) {}

  async begin(oldBinding?: string) {
    const state = newToken();
    const binding = newToken();
    const nonce = newToken();
    const verifier = newToken();
    const url = this.google.authorizationUrl(state, nonce, verifier);
    await this.prisma.oAuthLogin.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() } },
          ...(oldBinding ? [{ bindingHash: tokenHash(oldBinding) }] : []),
        ],
      },
    });
    await this.prisma.oAuthLogin.create({
      data: {
        stateHash: tokenHash(state),
        bindingHash: tokenHash(binding),
        nonce,
        verifier,
        expiresAt: new Date(Date.now() + this.config.loginDuration),
      },
    });
    return { url, binding };
  }

  async finish(
    state: unknown,
    code: unknown,
    binding?: string,
    oldSession?: string,
  ) {
    if (
      !isToken(state) ||
      !binding ||
      typeof code !== 'string' ||
      !code ||
      code.length > 4096
    ) {
      throw new UnauthorizedException('Invalid login callback');
    }
    const where = {
      stateHash: tokenHash(state),
      bindingHash: tokenHash(binding),
      expiresAt: { gt: new Date() },
    };
    const login = await this.prisma.oAuthLogin.findFirst({ where });
    if (
      !login ||
      (await this.prisma.oAuthLogin.deleteMany({ where })).count !== 1
    ) {
      throw new UnauthorizedException('Login request expired or already used');
    }
    // Consume once before network I/O, so racing callbacks cannot reuse the request.
    const identity = await this.google.verify(
      code,
      login.verifier,
      login.nonce,
    );
    const token = newToken();
    const expiresAt = new Date(Date.now() + this.config.sessionDuration);
    await this.prisma.$transaction(async (tx) => {
      // Never link accounts by email or accept a browser-supplied role.
      const user = await tx.user.upsert({
        where: { googleSubject: identity.subject },
        create: { googleSubject: identity.subject, email: identity.email },
        update: { email: identity.email },
      });
      await tx.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: new Date() } },
            ...(oldSession ? [{ tokenHash: tokenHash(oldSession) }] : []),
          ],
        },
      });
      await tx.session.create({
        data: { tokenHash: tokenHash(token), userId: user.id, expiresAt },
      });
    });
    return { token, expiresAt };
  }

  async userForSession(token?: string) {
    if (!token) return null;
    const session = await this.prisma.session.findFirst({
      where: { tokenHash: tokenHash(token), expiresAt: { gt: new Date() } },
      select: { user: { select: userSelection } },
    });
    return session?.user ?? null;
  }

  async logout(token?: string) {
    if (token)
      await this.prisma.session.deleteMany({
        where: { tokenHash: tokenHash(token) },
      });
  }
}
