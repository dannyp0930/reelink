BEGIN;

CREATE TYPE "ViewingType" AS ENUM ('THEATER', 'STREAMING', 'OTHER');

ALTER TABLE "MovieViewing"
  ADD COLUMN "watchedTime" VARCHAR(5),
  ADD COLUMN "viewingType" "ViewingType",
  ADD COLUMN "screeningFormat" VARCHAR(50),
  ADD COLUMN "streamingService" VARCHAR(80),
  ADD COLUMN "viewingDetail" VARCHAR(200);

-- Only an explicit cinema reference is evidence of a theater viewing.
-- Preserve all legacy dates, ratings, notes and auditorium-only records.
UPDATE "MovieViewing" SET "viewingType" = 'THEATER' WHERE "cinemaId" IS NOT NULL;

ALTER TABLE "MovieViewing"
  ADD CONSTRAINT "MovieViewing_watched_time"
    CHECK ("watchedTime" IS NULL OR "watchedTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "MovieViewing_context"
    CHECK (
      ("viewingType" IS NULL AND "screeningFormat" IS NULL AND "streamingService" IS NULL AND "viewingDetail" IS NULL)
      OR ("viewingType" IS NOT DISTINCT FROM 'THEATER'::"ViewingType" AND "streamingService" IS NULL AND "viewingDetail" IS NULL)
      OR ("viewingType" IS NOT DISTINCT FROM 'STREAMING'::"ViewingType" AND "cinemaId" IS NULL AND "auditorium" IS NULL AND "screeningFormat" IS NULL AND "viewingDetail" IS NULL)
      OR ("viewingType" IS NOT DISTINCT FROM 'OTHER'::"ViewingType" AND "cinemaId" IS NULL AND "auditorium" IS NULL AND "screeningFormat" IS NULL AND "streamingService" IS NULL)
    );

COMMIT;
