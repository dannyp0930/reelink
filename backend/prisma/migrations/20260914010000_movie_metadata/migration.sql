ALTER TABLE "Movie"
  ADD COLUMN "runtimeMinutes" INTEGER,
  ADD COLUMN "posterPath" VARCHAR(205),
  ADD CONSTRAINT "Movie_runtimeMinutes_check" CHECK ("runtimeMinutes" > 0),
  ADD CONSTRAINT "Movie_posterPath_check" CHECK ("posterPath" ~ '^/[a-zA-Z0-9_-]{1,200}\.(jpg|png)$');
