import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthConfig } from '../src/auth/auth.config';
import { Roles } from '../src/auth/auth.metadata';
import { GoogleOidcService } from '../src/auth/google-oidc.service';
import { newToken, readTokenCookie, tokenHash } from '../src/auth/auth.tokens';
import { PrismaService } from '../src/prisma/prisma.service';

// Test-only endpoints exercise global default-deny and role metadata.
@Controller('test-auth')
class AuthorizationProbe {
  @Get('private') privateRoute() {
    return { ok: true };
  }
  @Get('admin') @Roles('ADMIN') adminRoute() {
    return { ok: true };
  }
}

describe('Authentication and ownership (local PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const prefix = `auth-test-${randomUUID()}`;
  const loginHashes: string[] = [];
  const movieIds: string[] = [];
  const config = Object.assign(new AuthConfig(), {
    clientId: 'test-client',
    clientSecret: 'test-secret',
  });
  const provider = new GoogleOidcService(config);
  const verify = jest.spyOn(provider, 'verify').mockImplementation((code) => {
    if (code === 'deny') return Promise.reject(new Error('Provider refused'));
    return Promise.resolve({
      subject: `${prefix}-${code}`,
      email: `${prefix}-${code}@example.test`,
    });
  });

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/reelink_test'
    ) {
      throw new Error(
        'Auth integration tests require the local reelink_test database',
      );
    }
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AuthorizationProbe],
    })
      .overrideProvider(AuthConfig)
      .useValue(config)
      .overrideProvider(GoogleOidcService)
      .useValue(provider)
      .compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.oAuthLogin.deleteMany({
        where: { stateHash: { in: loginHashes } },
      });
      await prisma.user.deleteMany({
        where: { email: { startsWith: prefix } },
      });
      await prisma.movie.deleteMany({ where: { id: { in: movieIds } } });
    }
    await app?.close();
    verify.mockRestore();
  });

  function cookie(response: request.Response, name: string) {
    const setCookies = response.headers['set-cookie'] as unknown as string[];
    const value = setCookies?.find((part) => part.startsWith(`${name}=`));
    if (!value) throw new Error(`Missing ${name} cookie`);
    return value.split(';')[0];
  }

  async function begin() {
    const response = await request(app.getHttpServer())
      .get('/auth/google')
      .expect(303);
    const url = new URL(response.headers.location);
    const state = url.searchParams.get('state')!;
    loginHashes.push(tokenHash(state));
    return { state, cookie: cookie(response, config.loginCookie), url };
  }

  async function login(code: string = randomUUID(), oldCookie?: string) {
    const start = await begin();
    const response = await request(app.getHttpServer())
      .get('/auth/google/callback')
      .query({ code, state: start.state, role: 'ADMIN' })
      .set('Cookie', [start.cookie, ...(oldCookie ? [oldCookie] : [])])
      .expect(303);
    expect(response.headers.location).toBe(`${config.origin}/`);
    return { response, cookie: cookie(response, config.sessionCookie) };
  }

  it('keeps anonymous session status public but protects undecorated routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/session')
      .expect(200);
    expect(response.body).toEqual({ user: null, googleAvailable: true });
    expect(response.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer()).get('/test-auth/private').expect(401);
    await request(app.getHttpServer()).get('/viewings').expect(401);
  });

  it('creates a USER session with a hashed token and HttpOnly cookie', async () => {
    const signedIn = await login();
    expect(
      (signedIn.response.headers['set-cookie'] as unknown as string[]).join(
        ';',
      ),
    ).toContain('HttpOnly');
    expect(
      (signedIn.response.headers['set-cookie'] as unknown as string[]).join(
        ';',
      ),
    ).toContain('SameSite=Lax');
    const token = readTokenCookie(signedIn.cookie, config.sessionCookie)!;
    const row = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: tokenHash(token) },
    });
    expect(row.tokenHash).not.toBe(token);
    const response = await request(app.getHttpServer())
      .get('/auth/session')
      .set('Cookie', signedIn.cookie)
      .expect(200);
    const body = response.body as { user: { role: string } };
    expect(body.user.role).toBe('USER');
    expect(Object.keys(body.user).sort()).toEqual(['email', 'id', 'role']);
    await request(app.getHttpServer())
      .get('/test-auth/private')
      .set('Cookie', signedIn.cookie)
      .expect(200);
  });

  it('binds state to the initiating browser and consumes it only once', async () => {
    const start = await begin();
    const count = verify.mock.calls.length;
    await request(app.getHttpServer())
      .get('/auth/google/callback')
      .query({ state: start.state, code: 'alice' })
      .set('Cookie', `${config.loginCookie}=${newToken()}`)
      .expect('Location', `${config.origin}/?auth=failed`);
    expect(verify.mock.calls.length).toBe(count);
    await request(app.getHttpServer())
      .get('/auth/google/callback')
      .query({ state: start.state, code: 'alice' })
      .set('Cookie', start.cookie)
      .expect('Location', `${config.origin}/`);
    await request(app.getHttpServer())
      .get('/auth/google/callback')
      .query({ state: start.state, code: 'alice' })
      .set('Cookie', start.cookie)
      .expect('Location', `${config.origin}/?auth=failed`);
    expect(verify.mock.calls.length).toBe(count + 1);
  });

  it('allows only one racing callback to exchange a code', async () => {
    const start = await begin();
    const count = verify.mock.calls.length;
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .get('/auth/google/callback')
          .query({ state: start.state, code: 'race' })
          .set('Cookie', start.cookie),
      ),
    );
    expect(
      responses.map((response) => response.headers.location).sort(),
    ).toEqual([`${config.origin}/`, `${config.origin}/?auth=failed`].sort());
    expect(verify.mock.calls.length).toBe(count + 1);
  });

  it.each(['expired', 'missing', 'denied', 'provider-error'])(
    'rejects %s login without setting a session',
    async (mode) => {
      const start = await begin();
      if (mode === 'expired')
        await prisma.oAuthLogin.update({
          where: { stateHash: tokenHash(start.state) },
          data: { expiresAt: new Date(0) },
        });
      const response = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({
          state: mode === 'missing' ? undefined : start.state,
          code: mode === 'provider-error' ? 'deny' : 'test',
          error: mode === 'denied' ? 'access_denied' : undefined,
        })
        .set('Cookie', start.cookie)
        .expect('Location', `${config.origin}/?auth=failed`);
      expect(
        (response.headers['set-cookie'] as unknown as string[]).some((value) =>
          value.startsWith(`${config.sessionCookie}=`),
        ),
      ).toBe(false);
    },
  );

  it('rotates the browser session and preserves the Google account identity', async () => {
    const first = await login('repeat');
    const second = await login('repeat', first.cookie);
    expect(second.cookie).not.toBe(first.cookie);
    await request(app.getHttpServer())
      .get('/test-auth/private')
      .set('Cookie', first.cookie)
      .expect(401);
    expect(
      await prisma.user.count({ where: { googleSubject: `${prefix}-repeat` } }),
    ).toBe(1);
  });

  it('refuses email-based linking to an existing account', async () => {
    await prisma.user.create({
      data: { email: `${prefix}-collision@example.test` },
    });
    const start = await begin();
    await request(app.getHttpServer())
      .get('/auth/google/callback')
      .query({ state: start.state, code: 'collision' })
      .set('Cookie', start.cookie)
      .expect('Location', `${config.origin}/?auth=failed`);
    expect(
      await prisma.user.count({
        where: { googleSubject: `${prefix}-collision` },
      }),
    ).toBe(0);
  });

  it('rejects expired and tampered sessions', async () => {
    const signedIn = await login();
    const token = readTokenCookie(signedIn.cookie, config.sessionCookie)!;
    await prisma.session.update({
      where: { tokenHash: tokenHash(token) },
      data: { expiresAt: new Date(0) },
    });
    await request(app.getHttpServer())
      .get('/viewings')
      .set('Cookie', signedIn.cookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/viewings')
      .set('Cookie', `${config.sessionCookie}=${newToken()}`)
      .expect(401);
  });

  it('rejects cross-origin and origin-less logout; same-origin logout revokes the session', async () => {
    const signedIn = await login();
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', signedIn.cookie)
      .set('Origin', 'https://attacker.example')
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', signedIn.cookie)
      .expect(403);
    await request(app.getHttpServer())
      .get('/test-auth/private')
      .set('Cookie', signedIn.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', signedIn.cookie)
      .set('Origin', config.origin)
      .expect(303);
    await request(app.getHttpServer())
      .get('/test-auth/private')
      .set('Cookie', signedIn.cookie)
      .expect(401);
  });

  it('uses current DB roles and ignores forged browser roles', async () => {
    const signedIn = await login('roles');
    await request(app.getHttpServer())
      .get('/test-auth/admin')
      .query({ role: 'ADMIN' })
      .set('X-Role', 'ADMIN')
      .set('Cookie', signedIn.cookie)
      .expect(403);
    await prisma.user.update({
      where: { googleSubject: `${prefix}-roles` },
      data: { role: 'ADMIN' },
    });
    await request(app.getHttpServer())
      .get('/test-auth/admin')
      .set('Cookie', signedIn.cookie)
      .expect(200);
    await prisma.user.update({
      where: { googleSubject: `${prefix}-roles` },
      data: { role: 'USER' },
    });
    await request(app.getHttpServer())
      .get('/test-auth/admin')
      .set('Cookie', signedIn.cookie)
      .expect(403);
  });

  it('returns only owned viewings and hides other users records even from admins', async () => {
    const owner = await login('owner');
    const stranger = await login('stranger');
    const user = await prisma.user.findUniqueOrThrow({
      where: { googleSubject: `${prefix}-owner` },
    });
    const movie = await prisma.movie.create({
      data: { title: 'Private viewing test' },
    });
    movieIds.push(movie.id);
    const viewing = await prisma.movieViewing.create({
      data: {
        userId: user.id,
        movieId: movie.id,
        watchedOn: new Date('2026-09-07'),
        ratingHalfStars: 9,
      },
    });
    await request(app.getHttpServer())
      .get(`/viewings/${viewing.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/viewings/${viewing.id}`)
      .set('Cookie', stranger.cookie)
      .expect(404);
    await request(app.getHttpServer())
      .get('/viewings')
      .query({ userId: user.id })
      .set('Cookie', stranger.cookie)
      .expect(400);
    const list = await request(app.getHttpServer())
      .get('/viewings')
      .set('Cookie', stranger.cookie)
      .expect(200);
    expect(list.body).toMatchObject({ items: [], totalItems: 0 });
    await prisma.user.update({
      where: { googleSubject: `${prefix}-stranger` },
      data: { role: 'ADMIN' },
    });
    await request(app.getHttpServer())
      .get(`/viewings/${viewing.id}`)
      .set('Cookie', stranger.cookie)
      .expect(404);
  });
});
