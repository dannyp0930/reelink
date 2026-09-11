import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Viewing context migration', () => {
  it('preserves legacy records and enforces time/type constraints', async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/reelink_test'
    )
      throw new Error('Migration test requires local reelink_test');
    const prisma = new PrismaService();
    const rollback = new Error('ROLLBACK_MIGRATION_FIXTURE');
    const schema = `migration_${randomUUID().replaceAll('-', '')}`;
    const sql = readFileSync(
      resolve('prisma/migrations/20260911080000_viewing_context/migration.sql'),
      'utf8',
    );
    try {
      await prisma.$transaction(async (tx) => {
        // Generated identifier only. Every schema/table/row rolls back below.
        await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        await tx.$executeRawUnsafe(
          'CREATE TABLE "MovieViewing" (id integer PRIMARY KEY, "cinemaId" uuid, "auditorium" text, "watchedOn" date, "ratingHalfStars" integer, note text)',
        );
        await tx.$executeRaw`INSERT INTO "MovieViewing" VALUES (1, ${randomUUID()}::uuid, '3관', '2024-02-29', 0, 'keep'), (2, NULL, 'legacy room', '2023-12-31', NULL, 'unknown')`;
        const before = await tx.$queryRaw<
          Array<Record<string, unknown>>
        >`SELECT * FROM "MovieViewing" ORDER BY id`;
        // Execute the real migration inside the test's rollback transaction.
        for (const statement of sql
          .split(';')
          .map((part) => part.trim())
          .filter((part) => part && !['BEGIN', 'COMMIT'].includes(part)))
          await tx.$executeRawUnsafe(statement);
        const after = await tx.$queryRaw<
          Array<Record<string, unknown>>
        >`SELECT * FROM "MovieViewing" ORDER BY id`;
        expect(after).toEqual([
          {
            ...before[0],
            watchedTime: null,
            viewingType: 'THEATER',
            screeningFormat: null,
            streamingService: null,
            viewingDetail: null,
          },
          {
            ...before[1],
            watchedTime: null,
            viewingType: null,
            screeningFormat: null,
            streamingService: null,
            viewingDetail: null,
          },
        ]);
        for (const statement of [
          `UPDATE "MovieViewing" SET "watchedTime" = '24:00' WHERE id = 1`,
          `UPDATE "MovieViewing" SET "streamingService" = 'Netflix' WHERE id = 1`,
          `UPDATE "MovieViewing" SET "viewingDetail" = 'DVD' WHERE id = 2`,
          `UPDATE "MovieViewing" SET "viewingType" = 'STREAMING' WHERE id = 1`,
        ]) {
          await tx.$executeRawUnsafe('SAVEPOINT invalid_context');
          await expect(tx.$executeRawUnsafe(statement)).rejects.toThrow();
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_context');
        }
        throw rollback;
      });
      throw new Error('Migration fixture unexpectedly committed');
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await prisma.$disconnect();
    }
  });
});
