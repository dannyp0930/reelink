import { randomUUID } from 'node:crypto';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ratingToHalfStars } from '../src/movie-viewings/rating';

describe('PostgreSQL domain constraints', () => {
  let prisma: PrismaService;
  const rollback = new Error('ROLLBACK_TEST_DATA');
  const watchedOn = new Date('2026-09-07T00:00:00Z');

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !['/reelink', '/reelink_test'].includes(url.pathname)
    ) {
      throw new Error(
        'Database tests require a local reelink or reelink_test DB',
      );
    }
    prisma = new PrismaService();
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma?.onModuleDestroy();
  });

  // Every test rolls back its own transaction, including successful assertions.
  async function inTransaction(
    check: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    try {
      await prisma.$transaction(async (tx) => {
        await check(tx);
        throw rollback;
      });
      throw new Error('Test transaction unexpectedly committed');
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  async function seed(tx: Prisma.TransactionClient) {
    const user = await tx.user.create({
      data: { email: `${randomUUID()}@example.test` },
    });
    const movie = await tx.movie.create({ data: { title: 'Test movie' } });
    const cinema = await tx.cinema.create({
      data: { name: randomUUID(), chain: 'INDEPENDENT' },
    });
    return {
      userId: user.id,
      movieId: movie.id,
      cinemaId: cinema.id,
      watchedOn,
    };
  }

  async function goods(tx: Prisma.TransactionClient) {
    const viewing = await seed(tx);
    const campaign = await tx.goodsCampaign.create({
      data: {
        movieId: viewing.movieId,
        title: 'Test campaign',
        sourceType: 'OFFICIAL_PAGE',
        sourceUrl: 'https://example.test/event',
      },
    });
    const item = await tx.goodsItem.create({
      data: { campaignId: campaign.id, name: 'Poster', kind: 'POSTER' },
    });
    return { ...viewing, campaignId: campaign.id, itemId: item.id };
  }

  it('preserves every half-star, zero, unrated and repeat viewings on one date', () =>
    inTransaction(async (tx) => {
      const data = await seed(tx);
      for (const rating of [
        null,
        ...Array.from({ length: 11 }, (_, i) => i / 2),
      ]) {
        await tx.movieViewing.create({
          data: { ...data, ratingHalfStars: ratingToHalfStars(rating) },
        });
      }
      const rows = await tx.movieViewing.findMany({
        where: { userId: data.userId },
        orderBy: { ratingHalfStars: { sort: 'asc', nulls: 'last' } },
      });
      expect(rows.map((row) => row.ratingHalfStars)).toEqual([
        ...Array.from({ length: 11 }, (_, i) => i),
        null,
      ]);
      expect(
        rows.every((row) => row.watchedOn.getTime() === watchedOn.getTime()),
      ).toBe(true);
      expect(
        await tx.movieViewing.count({
          where: { userId: data.userId, ratingHalfStars: 9 },
        }),
      ).toBe(1);
    }));

  it.each([-1, 11])('rejects out-of-range rating units %s', (ratingHalfStars) =>
    inTransaction(async (tx) => {
      const data = await seed(tx);
      await expect(
        tx.movieViewing.create({ data: { ...data, ratingHalfStars } }),
      ).rejects.toThrow();
    }),
  );

  it('rejects a quarter-star before Prisma can truncate it', () =>
    inTransaction(async (tx) => {
      const data = await seed(tx);
      await expect(
        (async () => {
          await tx.movieViewing.create({
            data: { ...data, ratingHalfStars: ratingToHalfStars(0.75) },
          });
        })(),
      ).rejects.toThrow(RangeError);
      expect(
        await tx.movieViewing.count({ where: { userId: data.userId } }),
      ).toBe(0);
    }));

  it('updates and deletes a viewing without deleting its movie', () =>
    inTransaction(async (tx) => {
      const data = await seed(tx);
      const row = await tx.movieViewing.create({ data });
      const updated = await tx.movieViewing.update({
        where: { id: row.id },
        data: { ratingHalfStars: 9, auditorium: '1관', note: '재관람' },
      });
      expect(updated).toMatchObject({
        ratingHalfStars: 9,
        auditorium: '1관',
        note: '재관람',
      });
      await tx.movieViewing.delete({ where: { id: row.id } });
      expect(
        await tx.movie.findUnique({ where: { id: data.movieId } }),
      ).not.toBeNull();
    }));

  it('allows optional cinema and separate external ID namespaces', () =>
    inTransaction(async (tx) => {
      const data = await seed(tx);
      await tx.movieViewing.create({ data: { ...data, cinemaId: null } });
      await tx.movieExternalId.createMany({
        data: [
          { movieId: data.movieId, source: 'TMDB', externalId: '123' },
          { movieId: data.movieId, source: 'KOBIS', externalId: '123' },
        ],
      });
      expect(
        await tx.movieExternalId.count({ where: { movieId: data.movieId } }),
      ).toBe(2);
    }));

  it.each(['externalId', 'movieSource'] as const)(
    'rejects duplicate movie mapping: %s',
    (duplicate) =>
      inTransaction(async (tx) => {
        const data = await seed(tx);
        await tx.movieExternalId.create({
          data: { movieId: data.movieId, source: 'TMDB', externalId: '123' },
        });
        const movie = await tx.movie.create({ data: { title: 'Other movie' } });
        await expect(
          tx.movieExternalId.create({
            data: {
              movieId: duplicate === 'externalId' ? movie.id : data.movieId,
              source: 'TMDB',
              externalId: duplicate === 'externalId' ? '123' : '456',
            },
          }),
        ).rejects.toMatchObject({ code: 'P2002' });
      }),
  );

  it.each(['movie', 'cinema'] as const)(
    'protects referenced %s from deletion',
    (model) =>
      inTransaction(async (tx) => {
        const data = await seed(tx);
        await tx.movieViewing.create({ data });
        const deletion =
          model === 'movie'
            ? tx.movie.delete({ where: { id: data.movieId } })
            : tx.cinema.delete({ where: { id: data.cinemaId } });
        await expect(deletion).rejects.toMatchObject({ code: 'P2003' });
      }),
  );

  it('deletes personal viewings with their owner', () =>
    inTransaction(async (tx) => {
      const data = await seed(tx);
      await tx.movieViewing.create({ data });
      await tx.user.delete({ where: { id: data.userId } });
      expect(
        await tx.movieViewing.count({ where: { userId: data.userId } }),
      ).toBe(0);
    }));

  it.each(['candidate', 'observation'] as const)(
    'rejects mismatched campaign and item on %s',
    (model) =>
      inTransaction(async (tx) => {
        const a = await goods(tx);
        const b = await goods(tx);
        const data = {
          campaignId: a.campaignId,
          itemId: b.itemId,
          sourceType: 'ADMIN_NOTE' as const,
          note: 'Checked',
          observedAt: watchedOn,
        };
        const creation =
          model === 'candidate'
            ? tx.goodsCandidate.create({ data: { ...data, title: 'Report' } })
            : tx.goodsObservation.create({
                data: { ...data, cinemaId: a.cinemaId, status: 'UNKNOWN' },
              });
        await expect(creation).rejects.toMatchObject({ code: 'P2003' });
      }),
  );

  it('rejects a candidate item without its campaign', () =>
    inTransaction(async (tx) => {
      const data = await goods(tx);
      await expect(
        tx.goodsCandidate.create({
          data: {
            itemId: data.itemId,
            title: 'Report',
            sourceType: 'ADMIN_NOTE',
            note: 'Checked',
            observedAt: watchedOn,
          },
        }),
      ).rejects.toThrow();
    }));

  it.each([
    'OFFICIAL_PAGE',
    'OFFICIAL_SOCIAL',
    'USER_REPORT',
    'ADMIN_NOTE',
  ] as const)('accepts valid %s evidence on both goods models', (sourceType) =>
    inTransaction(async (tx) => {
      const data = await goods(tx);
      const evidence = {
        campaignId: data.campaignId,
        itemId: data.itemId,
        sourceType,
        observedAt: watchedOn,
        sourceUrl: sourceType.startsWith('OFFICIAL_')
          ? 'https://example.test/event'
          : null,
        note: sourceType === 'ADMIN_NOTE' ? 'Checked in person' : null,
      };
      await tx.goodsCandidate.create({
        data: { ...evidence, title: 'Report', submittedByUserId: data.userId },
      });
      await tx.goodsObservation.create({
        data: {
          ...evidence,
          cinemaId: data.cinemaId,
          status: 'UNKNOWN',
          reportedByUserId: data.userId,
        },
      });
    }),
  );

  it.each([
    ['OFFICIAL_PAGE', null, null],
    ['OFFICIAL_SOCIAL', '   ', null],
    ['USER_REPORT', null, null],
    ['ADMIN_NOTE', null, '   '],
  ] as const)(
    'rejects missing candidate evidence for %s',
    (sourceType, sourceUrl, note) =>
      inTransaction(async (tx) => {
        await expect(
          tx.goodsCandidate.create({
            data: {
              title: 'Report',
              sourceType,
              sourceUrl,
              note,
              observedAt: watchedOn,
            },
          }),
        ).rejects.toThrow();
      }),
  );

  it.each([
    ['OFFICIAL_PAGE', null, null],
    ['OFFICIAL_SOCIAL', '   ', null],
    ['USER_REPORT', null, null],
    ['ADMIN_NOTE', null, '   '],
  ] as const)(
    'rejects missing observation evidence for %s',
    (sourceType, sourceUrl, note) =>
      inTransaction(async (tx) => {
        const data = await goods(tx);
        await expect(
          tx.goodsObservation.create({
            data: {
              campaignId: data.campaignId,
              cinemaId: data.cinemaId,
              status: 'UNKNOWN',
              sourceType,
              sourceUrl,
              note,
              observedAt: watchedOn,
            },
          }),
        ).rejects.toThrow();
      }),
  );

  it.each([0, -1])(
    'rejects expiry at or before observation (%s ms)',
    (offset) =>
      inTransaction(async (tx) => {
        const data = await goods(tx);
        await expect(
          tx.goodsObservation.create({
            data: {
              campaignId: data.campaignId,
              cinemaId: data.cinemaId,
              status: 'UNKNOWN',
              sourceType: 'ADMIN_NOTE',
              note: 'Checked',
              observedAt: watchedOn,
              expiresAt: new Date(watchedOn.getTime() + offset),
            },
          }),
        ).rejects.toThrow();
      }),
  );

  it.each(['candidate', 'observation'] as const)(
    'preserves %s reporter history on user deletion',
    (model) =>
      inTransaction(async (tx) => {
        const data = await goods(tx);
        if (model === 'candidate') {
          await tx.goodsCandidate.create({
            data: {
              title: 'Report',
              sourceType: 'USER_REPORT',
              observedAt: watchedOn,
              submittedByUserId: data.userId,
            },
          });
        } else {
          await tx.goodsObservation.create({
            data: {
              campaignId: data.campaignId,
              cinemaId: data.cinemaId,
              status: 'UNKNOWN',
              sourceType: 'USER_REPORT',
              observedAt: watchedOn,
              reportedByUserId: data.userId,
            },
          });
        }
        await expect(
          tx.user.delete({ where: { id: data.userId } }),
        ).rejects.toMatchObject({ code: 'P2003' });
      }),
  );
});
