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
        await prisma.cinema.deleteMany({
          where: { OR: [{ id: cinemaId }, { name: { startsWith: cinemaId } }] },
        });
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

  it.each([
    {
      viewingType: 'THEATER',
      cinemaId,
      auditorium: '3관',
      screeningFormat: 'IMAX',
      watchedTime: '00:00',
    },
    {
      viewingType: 'STREAMING',
      streamingService: 'Netflix',
      watchedTime: '23:59',
    },
    { viewingType: 'OTHER', viewingDetail: 'Blu-ray', watchedTime: null },
    { viewingType: null, watchedTime: null },
  ])(
    'round-trips viewing context %# without changing the calendar day',
    async (context) => {
      const created = await write('post')
        .send({ ...input(), ...context })
        .expect(201);
      expect(created.body).toMatchObject({
        ...context,
        watchedOn: '2024-02-29T00:00:00.000Z',
      });
      const id = (created.body as { id: string }).id;
      const read = await request(app.getHttpServer())
        .get(`/viewings/${id}`)
        .set('Cookie', `${config.sessionCookie}=${ownerToken}`)
        .expect(200);
      expect(read.body).toMatchObject(context);
      const patched = await write('patch', `/viewings/${id}`)
        .send({ note: 'keep context' })
        .expect(200);
      expect(patched.body).toMatchObject(context);
      const list = await request(app.getHttpServer())
        .get('/viewings')
        .set('Cookie', `${config.sessionCookie}=${ownerToken}`)
        .expect(200);
      expect((list.body as { items: unknown[] }).items).toContainEqual(
        expect.objectContaining({ id, ...context }),
      );
    },
  );

  it('changes type atomically, clears incompatible details and preserves omitted time', async () => {
    const created = await write('post')
      .send({
        ...input(),
        cinemaId,
        auditorium: '3관',
        screeningFormat: 'IMAX',
        watchedTime: '19:30',
      })
      .expect(201);
    expect(created.body).toMatchObject({ viewingType: 'THEATER' });
    const path = `/viewings/${(created.body as { id: string }).id}`;
    const streaming = await write('patch', path)
      .send({ viewingType: 'STREAMING', streamingService: 'TVING' })
      .expect(200);
    expect(streaming.body).toMatchObject({
      cinemaId: null,
      auditorium: null,
      screeningFormat: null,
      viewingType: 'STREAMING',
      streamingService: 'TVING',
      watchedTime: '19:30',
    });
    await write('patch', path)
      .send({ auditorium: 'wrong type', note: 'must not persist' })
      .expect(400);
    await write('patch', path, strangerToken)
      .send({ viewingType: 'OTHER', viewingDetail: 'forged' })
      .expect(404);
    const other = await write('patch', path)
      .send({ viewingType: 'OTHER', viewingDetail: 'TV 방송' })
      .expect(200);
    expect(other.body).toMatchObject({
      streamingService: null,
      viewingDetail: 'TV 방송',
      note: null,
    });
    const cleared = await write('patch', path)
      .send({ viewingType: null, watchedTime: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      viewingType: null,
      watchedTime: null,
      viewingDetail: null,
      cinemaId: null,
    });
  });

  it.each([
    { watchedTime: '' },
    { watchedTime: '9:30' },
    { watchedTime: '24:00' },
    { watchedTime: '12:60' },
    { watchedTime: '12:30:00' },
    { watchedTime: '12:30\n' },
    { watchedTime: 1230 },
    { viewingType: 'OTT' },
    { viewingType: [] },
    { viewingType: 'STREAMING', cinemaId },
    { viewingType: 'OTHER', screeningFormat: 'IMAX' },
    { viewingType: 'THEATER', streamingService: 'Netflix' },
    { viewingType: null, viewingDetail: 'unknown' },
    { screeningFormat: 'a'.repeat(51) },
    { streamingService: 'a'.repeat(81) },
    { viewingDetail: 'a'.repeat(201) },
    { streamingService: 'bad\u0000value' },
  ])('rejects invalid context on create and patch %#', async (invalid) => {
    const row = await fixture();
    await write('post')
      .send({ ...input(), ...invalid })
      .expect(400);
    await write('patch', `/viewings/${row.id}`).send(invalid).expect(400);
    expect(
      await prisma.movieViewing.findUnique({ where: { id: row.id } }),
    ).toEqual(row);
  });

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
      address: null,
    });
  });

  it('searches cinema names literally, bounds results and returns historical location metadata', async () => {
    await prisma.cinema.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        name: `${cinemaId} CGV ${String(i).padStart(2, '0')}${i === 54 ? '%_\\' : ''}`,
        chain: 'CGV' as const,
        address: '서울 테스트 주소',
        status: 'TEMPORARILY_CLOSED' as const,
      })),
    });
    const get = (q: unknown) =>
      request(app.getHttpServer())
        .get('/cinemas')
        .set('Cookie', `${config.sessionCookie}=${ownerToken}`)
        .query({ q });
    const result = await get(`  ${cinemaId} cgv  `).expect(200);
    const cinemas = result.body as Array<{ name: string }>;
    expect(result.body).toHaveLength(50);
    expect(cinemas[0]).toMatchObject({
      name: `${cinemaId} CGV 00`,
      address: '서울 테스트 주소',
      status: 'TEMPORARILY_CLOSED',
    });
    expect(cinemas[49].name).toBe(`${cinemaId} CGV 49`);
    expect((await get(`${cinemaId} CGV 54%_\\`).expect(200)).body).toHaveLength(
      1,
    );
    expect((await get(`missing-${cinemaId}`).expect(200)).body).toEqual([]);
    for (const q of [['one', 'two'], 'x'.repeat(101), 'bad\0query'])
      await get(q).expect(400);
    const created = await write('post')
      .send({ ...input(), cinemaId })
      .expect(201);
    const record = created.body as {
      id: string;
      cinema: unknown;
      movie: unknown;
    };
    expect(record.cinema).toMatchObject({
      id: cinemaId,
      status: 'CLOSED',
      address: null,
    });
    expect(record.movie).toMatchObject({
      id: movieId,
      runtimeMinutes: null,
      posterUrl: null,
    });
    const detail = await request(app.getHttpServer())
      .get(`/viewings/${record.id}`)
      .set('Cookie', `${config.sessionCookie}=${ownerToken}`)
      .expect(200);
    expect(detail.body).toMatchObject({ cinema: record.cinema });
    expect(detail.body).not.toHaveProperty('movie.createdAt');
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
    expect((list.body as { items: unknown[] }).items).toEqual(
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

  describe('query contract', () => {
    const get = (query = '', token = ownerToken) =>
      request(app.getHttpServer())
        .get(`/viewings${query ? `?${query}` : ''}`)
        .set('Cookie', `${config.sessionCookie}=${token}`);
    type Page = {
      items: {
        id: string;
        watchedOn: string;
        watchedTime: string | null;
        ratingHalfStars: number | null;
      }[];
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
    };
    const seed = (
      watchedOn: string,
      ratingHalfStars: number | null = null,
      watchedTime: string | null = null,
      userId = ownerId,
    ) =>
      prisma.movieViewing.create({
        data: {
          userId,
          movieId,
          watchedOn: new Date(`${watchedOn}T00:00:00.000Z`),
          ratingHalfStars,
          watchedTime,
        },
      });

    beforeEach(async () => {
      await prisma.movieViewing.deleteMany({
        where: { userId: { in: [ownerId, strangerId] } },
      });
    });

    it('returns bounded pages with stable ties, accurate totals and no other owners', async () => {
      await prisma.movieViewing.createMany({
        data: Array.from({ length: 55 }, () => ({
          id: randomUUID(),
          userId: ownerId,
          movieId,
          watchedOn: new Date('2024-02-29T00:00:00Z'),
        })),
      });
      await seed('2024-02-29', 10, null, strangerId);
      const first = (await get('month=2024-02').expect(200)).body as Page;
      const second = (await get('month=2024-02&page=2').expect(200))
        .body as Page;
      expect(first).toMatchObject({
        page: 1,
        limit: 50,
        totalItems: 55,
        totalPages: 2,
      });
      expect(first.items).toHaveLength(50);
      expect(second.items).toHaveLength(5);
      const ids = [...first.items, ...second.items].map((row) => row.id);
      expect(new Set(ids).size).toBe(55);
      expect(ids).toEqual([...ids].sort().reverse());
      expect((await get('page=3').expect(200)).body).toMatchObject({
        items: [],
        page: 3,
        totalItems: 55,
        totalPages: 2,
      });
      expect((await get('month=2024-03').expect(200)).body).toMatchObject({
        items: [],
        totalItems: 0,
        totalPages: 0,
      });
      const admin = (
        await get('month=2024-02&sort=rating&limit=1', strangerToken).expect(
          200,
        )
      ).body as Page;
      expect(admin.totalItems).toBe(1);
      expect(admin.items[0].ratingHalfStars).toBe(10);
      await request(app.getHttpServer())
        .get('/viewings?month=2024-02')
        .expect(401);
    });

    it('filters every half-star exactly and keeps zero separate from unrated', async () => {
      for (let rating = 0; rating <= 10; rating++)
        await seed('2024-02-29', rating);
      await seed('2024-02-29');
      await seed('2024-03-01', 9);
      for (let rating = 0; rating <= 10; rating++) {
        const page = (
          await get(`month=2024-02&rating=${rating / 2}`).expect(200)
        ).body as Page;
        expect(page.totalItems).toBe(1);
        expect(page.items[0].ratingHalfStars).toBe(rating);
      }
      expect(
        (await get('month=2024-02&rating=unrated').expect(200)).body,
      ).toMatchObject({
        totalItems: 1,
        items: [expect.objectContaining({ ratingHalfStars: null })],
      });
      expect(
        (await get('month=2024-02&rating=all').expect(200)).body,
      ).toMatchObject({ totalItems: 12 });
    });

    it('sorts ratings descending, ties by date/id, and unrated last', async () => {
      const unrated = await seed('2026-01-01');
      const zero = await seed('2025-01-01', 0);
      const older = await seed('2024-02-28', 9);
      const a = await seed('2024-02-29', 9);
      const b = await seed('2024-02-29', 9);
      const best = await seed('2020-01-01', 10);
      const page = (await get('sort=rating').expect(200)).body as Page;
      expect(page.items.map((row) => row.id)).toEqual([
        best.id,
        ...[a.id, b.id].sort().reverse(),
        older.id,
        zero.id,
        unrated.id,
      ]);
      const newest = (await get('sort=newest&limit=1').expect(200))
        .body as Page;
      expect(newest.items[0].id).toBe(unrated.id);
    });

    it.each(['2024-02', '2025-02', '2025-12', '0001-01', '9999-12'])(
      'uses calendar month boundaries for %s without timezone conversion',
      async (month) => {
        const start = new Date(`${month}-01T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);
        const lastDay = new Date(end.getTime() - 86400000);
        const dates = [
          new Date(start.getTime() - 86400000),
          start,
          lastDay,
          end,
        ].filter(
          (date) => date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999,
        );
        await prisma.movieViewing.createMany({
          data: dates.map((watchedOn) => ({
            userId: ownerId,
            movieId,
            watchedOn,
          })),
        });
        const page = (await get(`month=${month}&sort=oldest`).expect(200))
          .body as Page;
        expect(page.totalItems).toBe(2);
        expect(page.items.map((row) => row.watchedOn)).toEqual([
          start.toISOString(),
          lastDay.toISOString(),
        ]);
      },
    );

    it('orders calendar records by date, known time and id, preserving midnight', async () => {
      const unknown = await seed('2024-02-29');
      const evening = await seed('2024-02-29', 8, '19:30');
      const midnight = await seed('2024-02-29', 8, '00:00');
      const another = await seed('2024-02-29', 9, '19:30');
      const previous = await seed('2024-02-28');
      const next = await seed('2024-03-01', 9, '00:00');
      const page = (await get('sort=oldest').expect(200)).body as Page;
      expect(page.items.map((row) => row.id)).toEqual([
        previous.id,
        midnight.id,
        ...[evening.id, another.id].sort(),
        unknown.id,
        next.id,
      ]);
    });

    it.each([
      'rating=',
      'rating=5.5',
      'rating=-0.5',
      'rating=4.25',
      'rating=NaN',
      'rating=null',
      'rating=1e0',
      'rating=0x1',
      'rating=4%0A',
      'rating=4&rating=5',
      'rating[x]=4',
      'sort=',
      'sort=unknown',
      'sort=rating&sort=newest',
      'month=',
      'month=2024-2',
      'month=0000-01',
      'month=2024-00',
      'month=2024-13',
      'month=2024-02-01',
      'month=2024-02%0A',
      'month=2024-01&month=2024-02',
      'page=0',
      'page=-1',
      'page=1.5',
      'page=',
      'page=1e2',
      'page=1000001',
      'page=999999999999999999999999',
      'page=1&page=2',
      'limit=0',
      'limit=101',
      'limit=1.5',
      'limit=',
      'userId=someone',
    ])('rejects malformed or unsupported query %s', async (query) => {
      await get(query).expect(400);
    });
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
