import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthConfig } from '../src/auth/auth.config';
import { newToken, tokenHash } from '../src/auth/auth.tokens';
import { PrismaService } from '../src/prisma/prisma.service';

describe('TMDB movie selection (local PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let config: AuthConfig;
  const userId = randomUUID();
  const sessionToken = newToken();
  const tmdbId = randomInt(1_000_000_000, 2_000_000_000);
  const externalIds = [tmdbId, tmdbId + 1, tmdbId + 2].map(String);
  const marker = `TMDB-test-${randomUUID()}`;
  const previousToken = process.env.TMDB_READ_ACCESS_TOKEN;
  const token = 'test-only-tmdb-token';
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  const movie = (id = tmdbId) => ({
    id,
    title: marker,
    original_title: 'Original title',
    release_date: '2024-02-29',
    runtime: 132,
    poster_path: '/fixture.jpg',
    overview: 'not forwarded',
  });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/reelink_test'
    ) {
      throw new Error(
        'Movie integration tests require the local reelink_test database',
      );
    }
    process.env.TMDB_READ_ACCESS_TOKEN = token;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    config = app.get(AuthConfig);
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.test` },
    });
    await prisma.session.create({
      data: {
        userId,
        tokenHash: tokenHash(sessionToken),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
  });

  beforeEach(() => {
    process.env.TMDB_READ_ACCESS_TOKEN = token;
    fetchMock
      .mockReset()
      .mockRejectedValue(new Error('Unexpected network request'));
  });

  afterAll(async () => {
    fetchMock.mockRestore();
    if (previousToken === undefined) delete process.env.TMDB_READ_ACCESS_TOKEN;
    else process.env.TMDB_READ_ACCESS_TOKEN = previousToken;
    try {
      if (prisma) {
        await prisma.user.deleteMany({ where: { id: userId } });
        await prisma.movie.deleteMany({
          where: {
            OR: [
              { title: marker },
              {
                externalIds: {
                  some: { source: 'TMDB', externalId: { in: externalIds } },
                },
              },
            ],
          },
        });
      }
    } finally {
      await app?.close();
    }
  });

  function search(query: Record<string, unknown>) {
    return request(app.getHttpServer())
      .get('/movies/search')
      .set('Cookie', `${config.sessionCookie}=${sessionToken}`)
      .query(query);
  }
  function select(id: number | string = tmdbId) {
    return request(app.getHttpServer())
      .post(`/movies/tmdb/${id}`)
      .set('Cookie', `${config.sessionCookie}=${sessionToken}`)
      .set('Origin', config.origin);
  }

  it('searches Korean titles without persisting or exposing provider-only fields', async () => {
    const count = await prisma.movie.count();
    fetchMock.mockResolvedValueOnce(
      json({ page: 2, total_pages: 700, results: [movie()] }),
    );
    const result = await search({ q: '  기생충 & x=1  ', page: '2' }).expect(
      200,
    );
    expect(result.body).toEqual({
      page: 2,
      totalPages: 500,
      results: [
        {
          tmdbId,
          title: marker,
          originalTitle: 'Original title',
          releaseDate: '2024-02-29',
          posterUrl: 'https://image.tmdb.org/t/p/w154/fixture.jpg',
        },
      ],
    });
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.text).not.toContain(token);
    expect(await prisma.movie.count()).toBe(count);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBeInstanceOf(URL);
    const target = url as URL;
    expect(target.origin).toBe('https://api.themoviedb.org');
    expect(target.pathname).toBe('/3/search/movie');
    expect(target.searchParams.get('query')).toBe('기생충 & x=1');
    expect(target.searchParams.get('language')).toBe('ko-KR');
    expect(target.searchParams.get('include_adult')).toBe('false');
    expect(target.searchParams.get('page')).toBe('2');
    expect(target.searchParams.has('api_key')).toBe(false);
    expect(options).toMatchObject({
      redirect: 'error',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('supports empty results and missing release dates', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ page: 1, total_pages: 0, results: [] }),
    );
    expect((await search({ q: '없는 영화' }).expect(200)).body).toEqual({
      page: 1,
      totalPages: 0,
      results: [],
    });
    fetchMock.mockResolvedValueOnce(
      json({
        page: 1,
        total_pages: 1,
        results: [{ ...movie(), release_date: '', original_title: '' }],
      }),
    );
    expect((await search({ q: '영화' }).expect(200)).body).toMatchObject({
      results: [{ releaseDate: null, originalTitle: null }],
    });
  });

  it.each([
    ['/abc123.jpg', 'https://image.tmdb.org/t/p/w154/abc123.jpg'],
    ['/abc123.png', 'https://image.tmdb.org/t/p/w154/abc123.png'],
    [null, null],
    [undefined, null],
    ['', null],
    ['https://attacker.example/poster.jpg', null],
    ['//attacker.example/poster.jpg', null],
    ['/../poster.jpg', null],
    ['/poster.svg', null],
    ['/poster.jpg?token=secret', null],
    ['/poster.jpg\n', null],
    [123, null],
  ])(
    'returns a fixed-host thumbnail or null (case %#)',
    async (path, expected) => {
      fetchMock.mockResolvedValueOnce(
        json({
          page: 1,
          total_pages: 1,
          results: [{ ...movie(), poster_path: path }],
        }),
      );
      expect((await search({ q: 'movie' }).expect(200)).body).toMatchObject({
        results: [{ posterUrl: expected }],
      });
    },
  );

  it.each([
    {},
    { q: '' },
    { q: '  ' },
    { q: 'x'.repeat(201) },
    { q: 'x\u0000y' },
    { q: ['one', 'two'] },
    { q: 'a', page: '0' },
    { q: 'a', page: '501' },
    { q: 'a', page: '1.5' },
    { q: 'a', page: ['1', '2'] },
  ])(
    'rejects invalid search before any network request (case %#)',
    async (query) => {
      await search(query).expect(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('requires login for search and selection, and Origin for selection', async () => {
    await request(app.getHttpServer())
      .get('/movies/search?q=movie')
      .expect(401);
    await request(app.getHttpServer())
      .post(`/movies/tmdb/${tmdbId}`)
      .set('Origin', config.origin)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/movies/tmdb/${tmdbId}`)
      .set('Cookie', `${config.sessionCookie}=${sessionToken}`)
      .expect(403);
    await select().set('Origin', 'https://attacker.example').expect(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '1.5', '1e2', '01', '2147483648', 'bad-id'])(
    'rejects invalid TMDB id %s',
    async (id) => {
      await select(id).expect(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rejects browser-supplied movie metadata', async () => {
    await select()
      .send({ title: 'forged', releaseDate: '2024-02-29' })
      .expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves a trusted movie once and uses its internal id for a viewing', async () => {
    fetchMock.mockResolvedValueOnce(json(movie()));
    const result = await select().expect(200);
    const body = result.body as { id: string };
    expect(result.body).toMatchObject({
      title: marker,
      originalTitle: 'Original title',
      releaseDate: '2024-02-29T00:00:00.000Z',
      runtimeMinutes: 132,
      posterUrl: 'https://image.tmdb.org/t/p/w154/fixture.jpg',
    });
    expect(
      await prisma.movieExternalId.findUnique({
        where: {
          source_externalId: { source: 'TMDB', externalId: String(tmdbId) },
        },
      }),
    ).toMatchObject({ movieId: body.id });
    const reused = await select().expect(200);
    expect((reused.body as { id: string }).id).toBe(body.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect((url as URL).pathname).toBe(`/3/movie/${tmdbId}`);
    await request(app.getHttpServer())
      .post('/viewings')
      .set('Origin', config.origin)
      .set('Cookie', `${config.sessionCookie}=${sessionToken}`)
      .send({ movieId: body.id, watchedOn: '2026-09-08', rating: 4.5 })
      .expect(201);
  });

  it('does not merge movies with the same title and resolves a concurrent selection once', async () => {
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async () => {
      arrivals++;
      if (arrivals === 2) release();
      await barrier;
      return json(movie(tmdbId + 1));
    });
    const before = await prisma.movie.count({ where: { title: marker } });
    const responses = await Promise.all([
      select(tmdbId + 1),
      select(tmdbId + 1),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect((responses[0].body as { id: string }).id).toBe(
      (responses[1].body as { id: string }).id,
    );
    expect(await prisma.movie.count({ where: { title: marker } })).toBe(
      before + 1,
    );
  });

  it('enriches missing fields on reselection without replacing saved metadata', async () => {
    const link = await prisma.movieExternalId.findUniqueOrThrow({
      where: {
        source_externalId: { source: 'TMDB', externalId: String(tmdbId) },
      },
    });
    const before = await prisma.movie.update({
      where: { id: link.movieId },
      data: { runtimeMinutes: null, posterPath: null },
    });
    fetchMock.mockResolvedValueOnce(
      json({
        ...movie(),
        title: 'must not replace',
        release_date: '2026-01-01',
      }),
    );
    const result = await select().expect(200);
    expect(result.body).toMatchObject({
      id: before.id,
      title: before.title,
      releaseDate: before.releaseDate!.toISOString(),
      runtimeMinutes: 132,
      posterUrl: 'https://image.tmdb.org/t/p/w154/fixture.jpg',
    });
    expect(result.body).not.toHaveProperty('posterPath');
    expect(result.body).not.toHaveProperty('createdAt');
    await select().expect(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([null, 0, -1, 1.5, '132', 2147483648])(
    'treats optional invalid metadata as unknown (%s)',
    async (runtime) => {
      const existing = await prisma.movieExternalId.findUniqueOrThrow({
        where: {
          source_externalId: { source: 'TMDB', externalId: String(tmdbId) },
        },
      });
      await prisma.movie.update({
        where: { id: existing.movieId },
        data: { runtimeMinutes: null, posterPath: null },
      });
      fetchMock.mockResolvedValueOnce(
        json({ ...movie(), runtime, poster_path: '//evil.example/a.jpg' }),
      );
      expect((await select().expect(200)).body).toMatchObject({
        runtimeMinutes: null,
        posterUrl: null,
      });
    },
  );

  it('keeps existing movies usable when enrichment times out or credentials are absent', async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException('timeout', 'TimeoutError'),
    );
    expect((await select().expect(200)).body).toMatchObject({
      title: marker,
      runtimeMinutes: null,
    });
    delete process.env.TMDB_READ_ACCESS_TOKEN;
    await select().expect(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite metadata filled during an enrichment request', async () => {
    const existing = await prisma.movieExternalId.findUniqueOrThrow({
      where: {
        source_externalId: { source: 'TMDB', externalId: String(tmdbId) },
      },
    });
    fetchMock.mockImplementationOnce(async () => {
      await prisma.movie.update({
        where: { id: existing.movieId },
        data: { runtimeMinutes: 99, posterPath: '/winner.png' },
      });
      return json(movie());
    });
    expect((await select().expect(200)).body).toMatchObject({
      runtimeMinutes: 99,
      posterUrl: 'https://image.tmdb.org/t/p/w154/winner.png',
    });
  });

  it('reports missing server credentials without making a request', async () => {
    delete process.env.TMDB_READ_ACCESS_TOKEN;
    await search({ q: 'movie' }).expect(503);
    await select(tmdbId + 2).expect(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 503],
    [403, 503],
    [429, 503],
    [500, 502],
    [302, 502],
  ])('sanitizes upstream status %s', async (upstream, expected) => {
    fetchMock.mockResolvedValueOnce(
      json({ secret: token, details: 'provider error' }, upstream),
    );
    const result = await search({ q: 'movie' }).expect(expected);
    expect(result.text).not.toContain(token);
    expect(result.text).not.toContain('provider error');
  });

  it('returns 404 for a missing upstream movie without creating local data', async () => {
    fetchMock.mockResolvedValueOnce(json({ status_message: token }, 404));
    const result = await select(tmdbId + 2).expect(404);
    expect(result.text).not.toContain(token);
    expect(
      await prisma.movieExternalId.findUnique({
        where: {
          source_externalId: { source: 'TMDB', externalId: String(tmdbId + 2) },
        },
      }),
    ).toBeNull();
  });

  it.each([
    new Error('network test-only-tmdb-token'),
    new DOMException('timeout', 'TimeoutError'),
  ])('sanitizes network failures (case %#)', async (error) => {
    fetchMock.mockRejectedValueOnce(error);
    const result = await search({ q: 'movie' }).expect(
      error.name === 'TimeoutError' ? 504 : 502,
    );
    expect(result.text).not.toContain(token);
  });

  it.each([
    null,
    { page: 1, total_pages: 1, results: null },
    { page: 1, total_pages: 1, results: [{ id: 1, title: 12 }] },
    { page: 1, total_pages: 1, results: [{ id: 1, title: 'bad\u0000title' }] },
    {
      page: 1,
      total_pages: 1,
      results: [{ id: 1, title: 'movie', release_date: '2023-02-29' }],
    },
  ])('rejects malformed upstream search data (case %#)', async (body) => {
    fetchMock.mockResolvedValueOnce(json(body));
    await search({ q: 'movie' }).expect(502);
  });

  it('maps a timeout while reading the response body to 504', async () => {
    const response = json({});
    jest
      .spyOn(response, 'json')
      .mockRejectedValue(new DOMException('Body aborted', 'AbortError'));
    const timeout = jest
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(
        AbortSignal.abort(new DOMException('Deadline reached', 'TimeoutError')),
      );
    try {
      fetchMock.mockResolvedValueOnce(response);
      await search({ q: 'movie' }).expect(504);
      expect(timeout).toHaveBeenCalledWith(10_000);
    } finally {
      timeout.mockRestore();
    }
  });

  it('rejects invalid JSON and mismatched detail ids before persistence', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{invalid json', { status: 200 }),
    );
    await search({ q: 'movie' }).expect(502);
    fetchMock.mockResolvedValueOnce(json(movie(tmdbId)));
    await select(tmdbId + 2).expect(502);
    expect(
      await prisma.movieExternalId.findUnique({
        where: {
          source_externalId: { source: 'TMDB', externalId: String(tmdbId + 2) },
        },
      }),
    ).toBeNull();
  });
});
