-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MovieSource" AS ENUM ('TMDB', 'KOBIS');

-- CreateEnum
CREATE TYPE "CinemaChain" AS ENUM ('CGV', 'LOTTE', 'MEGABOX', 'CINE_Q', 'INDEPENDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CinemaStatus" AS ENUM ('ACTIVE', 'TEMPORARILY_CLOSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('OFFICIAL_PAGE', 'OFFICIAL_SOCIAL', 'USER_REPORT', 'ADMIN_NOTE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ENDED');

-- CreateEnum
CREATE TYPE "GoodsItemKind" AS ENUM ('POSTER', 'TICKET', 'CARD', 'STICKER', 'OTHER');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('UNKNOWN', 'LIKELY_AVAILABLE', 'LOW_OR_DEPLETING', 'SOLD_OUT', 'ENDED');

-- CreateEnum
CREATE TYPE "CandidateReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movie" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "releaseDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Movie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieExternalId" (
    "id" UUID NOT NULL,
    "movieId" UUID NOT NULL,
    "source" "MovieSource" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "MovieExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieViewing" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "movieId" UUID NOT NULL,
    "watchedOn" DATE NOT NULL,
    "cinemaId" UUID,
    "auditorium" TEXT,
    "ratingHalfStars" SMALLINT,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MovieViewing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cinema" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "chain" "CinemaChain" NOT NULL,
    "status" "CinemaStatus" NOT NULL DEFAULT 'ACTIVE',
    "address" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Cinema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsCampaign" (
    "id" UUID NOT NULL,
    "movieId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "sourceType" "SourceType" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GoodsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsItem" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GoodsItemKind" NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GoodsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsObservation" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "itemId" UUID,
    "cinemaId" UUID NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceUrl" TEXT,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "note" TEXT,
    "reportedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsCandidate" (
    "id" UUID NOT NULL,
    "campaignId" UUID,
    "itemId" UUID,
    "cinemaId" UUID,
    "title" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceUrl" TEXT,
    "reportedStatus" "AvailabilityStatus",
    "note" TEXT,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "reviewStatus" "CandidateReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "submittedByUserId" UUID,
    "reviewedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GoodsCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MovieExternalId_source_externalId_key" ON "MovieExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MovieExternalId_movieId_source_key" ON "MovieExternalId"("movieId", "source");

-- CreateIndex
CREATE INDEX "MovieViewing_userId_watchedOn_idx" ON "MovieViewing"("userId", "watchedOn");

-- CreateIndex
CREATE INDEX "MovieViewing_userId_ratingHalfStars_idx" ON "MovieViewing"("userId", "ratingHalfStars");

-- CreateIndex
CREATE INDEX "MovieViewing_movieId_idx" ON "MovieViewing"("movieId");

-- CreateIndex
CREATE INDEX "MovieViewing_cinemaId_idx" ON "MovieViewing"("cinemaId");

-- CreateIndex
CREATE UNIQUE INDEX "Cinema_chain_name_key" ON "Cinema"("chain", "name");

-- CreateIndex
CREATE INDEX "GoodsCampaign_movieId_status_idx" ON "GoodsCampaign"("movieId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsItem_campaignId_name_key" ON "GoodsItem"("campaignId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsItem_id_campaignId_key" ON "GoodsItem"("id", "campaignId");

-- CreateIndex
CREATE INDEX "GoodsObservation_campaignId_itemId_cinemaId_observedAt_idx" ON "GoodsObservation"("campaignId", "itemId", "cinemaId", "observedAt");

-- CreateIndex
CREATE INDEX "GoodsCandidate_reviewStatus_createdAt_idx" ON "GoodsCandidate"("reviewStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "MovieExternalId" ADD CONSTRAINT "MovieExternalId_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieViewing" ADD CONSTRAINT "MovieViewing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieViewing" ADD CONSTRAINT "MovieViewing_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieViewing" ADD CONSTRAINT "MovieViewing_cinemaId_fkey" FOREIGN KEY ("cinemaId") REFERENCES "Cinema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsCampaign" ADD CONSTRAINT "GoodsCampaign_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsItem" ADD CONSTRAINT "GoodsItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GoodsCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsObservation" ADD CONSTRAINT "GoodsObservation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GoodsCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsObservation" ADD CONSTRAINT "GoodsObservation_itemId_campaignId_fkey" FOREIGN KEY ("itemId", "campaignId") REFERENCES "GoodsItem"("id", "campaignId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "GoodsObservation" ADD CONSTRAINT "GoodsObservation_cinemaId_fkey" FOREIGN KEY ("cinemaId") REFERENCES "Cinema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsObservation" ADD CONSTRAINT "GoodsObservation_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsCandidate" ADD CONSTRAINT "GoodsCandidate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GoodsCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsCandidate" ADD CONSTRAINT "GoodsCandidate_itemId_campaignId_fkey" FOREIGN KEY ("itemId", "campaignId") REFERENCES "GoodsItem"("id", "campaignId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "GoodsCandidate" ADD CONSTRAINT "GoodsCandidate_cinemaId_fkey" FOREIGN KEY ("cinemaId") REFERENCES "Cinema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsCandidate" ADD CONSTRAINT "GoodsCandidate_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsCandidate" ADD CONSTRAINT "GoodsCandidate_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma does not express these CHECK constraints. Keep them in migrations.
ALTER TABLE "MovieViewing"
  ADD CONSTRAINT "MovieViewing_rating_half_stars_range"
    CHECK ("ratingHalfStars" IS NULL OR "ratingHalfStars" BETWEEN 0 AND 10);

ALTER TABLE "GoodsCandidate"
  ADD CONSTRAINT "GoodsCandidate_item_requires_campaign"
    CHECK ("itemId" IS NULL OR "campaignId" IS NOT NULL),
  ADD CONSTRAINT "GoodsCandidate_source_evidence"
    CHECK (
      ("sourceType" IN ('OFFICIAL_PAGE', 'OFFICIAL_SOCIAL')
        AND NULLIF(btrim("sourceUrl"), '') IS NOT NULL)
      OR ("sourceType" = 'USER_REPORT' AND "submittedByUserId" IS NOT NULL)
      OR ("sourceType" = 'ADMIN_NOTE' AND NULLIF(btrim("note"), '') IS NOT NULL)
    );

ALTER TABLE "GoodsObservation"
  ADD CONSTRAINT "GoodsObservation_source_evidence"
    CHECK (
      ("sourceType" IN ('OFFICIAL_PAGE', 'OFFICIAL_SOCIAL')
        AND NULLIF(btrim("sourceUrl"), '') IS NOT NULL)
      OR ("sourceType" = 'USER_REPORT' AND "reportedByUserId" IS NOT NULL)
      OR ("sourceType" = 'ADMIN_NOTE' AND NULLIF(btrim("note"), '') IS NOT NULL)
    ),
  ADD CONSTRAINT "GoodsObservation_expiry_after_observation"
    CHECK ("expiresAt" IS NULL OR "expiresAt" > "observedAt");
