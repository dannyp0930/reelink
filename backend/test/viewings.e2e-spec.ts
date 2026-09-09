import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthConfig } from '../src/auth/auth.config';
import { newToken, tokenHash } from '../src/auth/auth.tokens';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Viewing writes (local PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let config: AuthConfig;
  const ownerId = randomUUID();
  const strangerId = randomUUID();
  const movieId = randomUUID();
  const otherMovieId = randomUUID();
  const cinemaId = randomUUID();
  const ownerToken = newToken();
  const strangerToken = newToken();

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/reelink_test'
    ) {
      throw new Error(
        'Viewing integration tests require the local reelink_test database',
      );
    }
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    config = app.get(AuthConfig);
    await prisma.user.createMany({
      data: [
        { id: ownerId, email: `${ownerId}@example.test` },
        { id: strangerId, email: `${strangerId}@example.test`, role: 'ADMIN' },
      ],
    });
    await prisma.session.createMany({
      data: [
        {
          userId: ownerId,
          tokenHash: tokenHash(ownerToken),
          expiresAt: new Date(Date.now() + 600_000),
        },
        {
          userId: strangerId,
          tokenHash: tokenHash(strangerToken),
          expiresAt: new Date(Date.now() + 600_000),
        },
      ],
    });
    await prisma.movie.createMany({
      data: [
        { id: movieId, title: 'Viewing write fixture' },
        { id: otherMovieId, title: 'Replacement movie fixture' },
      ],
    });
    await prisma.cinema.create({
      data: { id: cinemaId, name: cinemaId, chain: 'INDEPENDENT' },
    });
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.user.deleteMany({
          where: { id: { in: [ownerId, strangerId] } },
        });
        await prisma.movie.deleteMany({
          where: { id: { in: [movieId, otherMovieId] } },
        });
        await prisma.cinema.deleteMany({ where: { id: cinemaId } });
      }
    } finally {
      await app?.close();
    }
  });

  function write(
    method: 'post' | 'patch' | 'delete',
    path = '/viewings',
    token = ownerToken,
  ) {
    return request(app.getHttpServer())
      [method](path)
      .set('Origin', config.origin)
      .set('Cookie', `${config.sessionCookie}=${token}`);
  }

  const input = () => ({ movieId, watchedOn: '2024-02-29' });

  it('lists cinema choices with status for historical viewings and requires login', async () => {
    await request(app.getHttpServer()).get('/cinemas').expect(401);
    await prisma.cinema.update({
      where: { id: cinemaId },
      data: { status: 'CLOSED' },
    });
    const response = await request(app.getHttpServer())
      .get('/cinemas')
      .set('Cookie', `${config.sessionCookie}=${ownerToken}`)
      .expect(200);
    expect(response.body).toContainEqual({
      id: cinemaId,
      name: cinemaId,
      chain: 'INDEPENDENT',
      status: 'CLOSED',
    });
  });

  async function fixture() {
    return prisma.movieViewing.create({
      data: {
        userId: ownerId,
        movieId,
        watchedOn: new Date('2024-02-29T00:00:00.000Z'),
        cinemaId,
        auditorium: '1관',
        ratingHalfStars: 9,
        note: '원래 메모',
      },
    });
  }

  it('creates an owned viewing with all fields and returns it through existing reads', async () => {
    const response = await write('post')
      .send({
        ...input(),
        cinemaId,
        auditorium: '1관',
        rating: 4.5,
        note: '좋았다',
      })
      .expect(201);
    const body = response.body as { id: string };
    expect(response.body).toMatchObject({
      ...input(),
      watchedOn: '2024-02-29T00:00:00.000Z',
      userId: ownerId,
      cinemaId,
      auditorium: '1관',
      ratingHalfStars: 9,
      note: '좋았다',
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(
      await prisma.movieViewing.findUnique({ where: { id: body.id } }),
    ).toMatchObject({ userId: ownerId, ratingHalfStars: 9 });
    await request(app.getHttpServer())
      .get(`/viewings/${body.id}`)
      .set('Cookie', `${config.sessionCookie}=${ownerToken}`)
      .expect(200);
    const list = await request(app.getHttpServer())
      .get('/viewings')
      .set('Cookie', `${config.sessionCookie}=${ownerToken}`)
      .expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: body.id })]),
    );
  });

  it('defaults omitted optional fields to null and allows repeat viewings', async () => {
    const first = await write('post').send(input()).expect(201);
    const second = await write('post').send(input()).expect(201);
    expect(first.body).toMatchObject({
      ratingHalfStars: null,
      cinemaId: null,
      auditorium: null,
      note: null,
    });
    expect((first.body as { id: string }).id).not.toBe(
      (second.body as { id: string }).id,
    );
  });

  it.each([null, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])(
    'preserves rating %s on create',
    async (rating) => {
      const response = await write('post')
        .send({ ...input(), rating })
        .expect(201);
      expect(response.body).toMatchObject({
        ratingHalfStars: rating === null ? null : rating * 2,
      });
    },
  );

  it('patches only provided fields and permits clearing optional fields', async () => {
    const row = await fixture();
    const path = `/viewings/${row.id}`;
    const changed = await write('patch', path)
      .send({ note: '수정 메모', rating: 0 })
      .expect(200);
    expect(changed.body).toMatchObject({
      movieId,
      cinemaId,
      watchedOn: '2024-02-29T00:00:00.000Z',
      auditorium: '1관',
      ratingHalfStars: 0,
      note: '수정 메모',
    });
    const cleared = await write('patch', path)
      .send({ note: null, auditorium: null, cinemaId: null, rating: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      movieId,
      ratingHalfStars: null,
      cinemaId: null,
      auditorium: null,
      note: null,
    });
    const moved = await write('patch', path)
      .send({
        movieId: otherMovieId,
        watchedOn: '2026-09-08',
        cinemaId,
        auditorium: '2관',
        rating: 5,
      })
      .expect(200);
    expect(moved.body).toMatchObject({
      movieId: otherMovieId,
      watchedOn: '2026-09-08T00:00:00.000Z',
      cinemaId,
      auditorium: '2관',
      ratingHalfStars: 10,
    });
  });

  it('accepts text limits and keeps empty strings distinct from null', async () => {
    const created = await write('post')
      .send({ ...input(), auditorium: 'a'.repeat(100), note: 'a'.repeat(5000) })
      .expect(201);
    const body = created.body as {
      id: string;
      note: string;
      auditorium: string;
    };
    expect(body.note).toHaveLength(5000);
    expect(body.auditorium).toHaveLength(100);
    const changed = await write('patch', `/viewings/${body.id}`)
      .send({ note: '', auditorium: '' })
      .expect(200);
    expect(changed.body).toMatchObject({ note: '', auditorium: '' });
  });

  it.each(['note', 'auditorium'])(
    'rejects NUL in %s before reaching PostgreSQL',
    async (field) => {
      const row = await fixture();
      await write('post')
        .send({ ...input(), [field]: 'bad\u0000text' })
        .expect(400);
      await write('patch', `/viewings/${row.id}`)
        .send({ [field]: 'bad\u0000text' })
        .expect(400);
      expect(
        await prisma.movieViewing.findUnique({ where: { id: row.id } }),
      ).toEqual(row);
    },
  );

  it('deletes only the selected viewing and keeps movie and cinema', async () => {
    const row = await fixture();
    const other = await fixture();
    const response = await write('delete', `/viewings/${row.id}`).expect(204);
    expect(response.text).toBe('');
    expect(
      await prisma.movieViewing.findUnique({ where: { id: row.id } }),
    ).toBeNull();
    expect(
      await prisma.movieViewing.findUnique({ where: { id: other.id } }),
    ).not.toBeNull();
    expect(
      await prisma.movie.findUnique({ where: { id: movieId } }),
    ).not.toBeNull();
    expect(
      await prisma.cinema.findUnique({ where: { id: cinemaId } }),
    ).not.toBeNull();
    await write('delete', `/viewings/${row.id}`).expect(404);
  });

  it.each(['post', 'patch', 'delete'] as const)(
    'protects %s with authentication and Origin checks',
    async (method) => {
      const row = await fixture();
      const path = method === 'post' ? '/viewings' : `/viewings/${row.id}`;
      await request(app.getHttpServer())
        [method](path)
        .set('Origin', config.origin)
        .send(input())
        .expect(401);
      for (const origin of [undefined, 'https://attacker.example']) {
        const req = request(app.getHttpServer())
          [method](path)
          .set('Cookie', `${config.sessionCookie}=${ownerToken}`);
        if (origin) req.set('Origin', origin);
        await req.send(input()).expect(403);
      }
      expect(
        await prisma.movieViewing.findUnique({ where: { id: row.id } }),
      ).not.toBeNull();
    },
  );

  it('hides other users records even from an admin and leaves them unchanged', async () => {
    const row = await fixture();
    await write('patch', `/viewings/${row.id}`, strangerToken)
      .send({ rating: 0 })
      .expect(404);
    await write('delete', `/viewings/${row.id}`, strangerToken).expect(404);
    expect(
      await prisma.movieViewing.findUnique({ where: { id: row.id } }),
    ).toEqual(row);
    await write('patch', `/viewings/${randomUUID()}`)
      .send({ note: 'missing' })
      .expect(404);
  });

  it.each([
    { rating: -0.5 },
    { rating: 5.5 },
    { rating: 0.25 },
    { rating: '4.5' },
    { rating: true },
    { watchedOn: '2023-02-29' },
    { watchedOn: '2024-04-31' },
    { watchedOn: '2024-13-01' },
    { watchedOn: '2024-2-01' },
    { watchedOn: '0000-01-01' },
    { watchedOn: '2024-02-29T00:00:00Z' },
    { watchedOn: null },
    { movieId: 'bad-id' },
    { movieId: null },
    { cinemaId: 'bad-id' },
    { auditorium: 3 },
    { auditorium: 'a'.repeat(101) },
    { note: false },
    { note: 'a'.repeat(5001) },
    { userId: 'forged-owner' },
    { id: 'forged-id' },
    { ratingHalfStars: 9 },
    { movie: { create: { title: 'injected' } } },
  ])(
    'rejects invalid create and patch without changing data (case %#)',
    async (invalid) => {
      const row = await fixture();
      const before = await prisma.movieViewing.count({
        where: { userId: ownerId },
      });
      await write('post')
        .send({ ...input(), ...invalid })
        .expect(400);
      await write('patch', `/viewings/${row.id}`).send(invalid).expect(400);
      expect(
        await prisma.movieViewing.count({ where: { userId: ownerId } }),
      ).toBe(before);
      expect(
        await prisma.movieViewing.findUnique({ where: { id: row.id } }),
      ).toEqual(row);
    },
  );

  it('rejects missing required fields, arrays, unknown keys and empty patches', async () => {
    for (const body of [{}, { movieId }, { watchedOn: '2024-02-29' }, []]) {
      await write('post').send(body).expect(400);
    }
    const row = await fixture();
    for (const body of [
      {},
      [],
      JSON.parse('{"__proto__":{"userId":"forged"}}') as unknown as object,
    ]) {
      await write('patch', `/viewings/${row.id}`).send(body).expect(400);
    }
    await write('patch', '/viewings/not-a-uuid')
      .send({ rating: 0 })
      .expect(400);
    await write('delete', '/viewings/not-a-uuid').expect(400);
  });

  it.each(['movieId', 'cinemaId'])(
    'rejects a nonexistent %s on create and patch without a partial write',
    async (field) => {
      const invalid = { [field]: randomUUID() };
      const row = await fixture();
      const before = await prisma.movieViewing.count({
        where: { userId: ownerId },
      });
      await write('post')
        .send({ ...input(), ...invalid })
        .expect(400);
      await write('patch', `/viewings/${row.id}`)
        .send({ note: 'must not persist', ...invalid })
        .expect(400);
      expect(
        await prisma.movieViewing.count({ where: { userId: ownerId } }),
      ).toBe(before);
      expect(
        await prisma.movieViewing.findUnique({ where: { id: row.id } }),
      ).toEqual(row);
    },
  );
});
