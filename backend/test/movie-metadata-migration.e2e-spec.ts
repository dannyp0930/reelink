import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';

it('adds nullable metadata without changing legacy movies and rejects unsafe values', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.pathname !== '/reelink_test'
  )
    throw new Error('Migration test requires local reelink_test');
  const prisma = new PrismaService();
  const rollback = new Error('ROLLBACK_METADATA_FIXTURE');
  const schema = `migration_${randomUUID().replaceAll('-', '')}`;
  const sql = readFileSync(
    resolve('prisma/migrations/20260914010000_movie_metadata/migration.sql'),
    'utf8',
  );
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(
        'CREATE TABLE "Movie" (id integer PRIMARY KEY, title text, "releaseDate" date)',
      );
      await tx.$executeRaw`INSERT INTO "Movie" VALUES (1, 'keep', '2024-02-29'), (2, 'unknown', NULL)`;
      const before = await tx.$queryRaw<
        Array<Record<string, unknown>>
      >`SELECT * FROM "Movie" ORDER BY id`;
      await tx.$executeRawUnsafe(sql);
      expect(await tx.$queryRaw`SELECT * FROM "Movie" ORDER BY id`).toEqual(
        before.map((row) => ({
          ...row,
          runtimeMinutes: null,
          posterPath: null,
        })),
      );
      await tx.$executeRaw`UPDATE "Movie" SET "runtimeMinutes" = 132, "posterPath" = '/valid.jpg' WHERE id = 1`;
      for (const statement of [
        `UPDATE "Movie" SET "runtimeMinutes" = 0 WHERE id = 1`,
        `UPDATE "Movie" SET "runtimeMinutes" = -1 WHERE id = 1`,
        `UPDATE "Movie" SET "posterPath" = '//evil.example/a.jpg' WHERE id = 1`,
        `UPDATE "Movie" SET "posterPath" = '/a.svg' WHERE id = 1`,
      ]) {
        await tx.$executeRawUnsafe('SAVEPOINT invalid_metadata');
        await expect(tx.$executeRawUnsafe(statement)).rejects.toThrow();
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_metadata');
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
