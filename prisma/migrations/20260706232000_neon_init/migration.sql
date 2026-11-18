-- CreateEnum
CREATE TYPE "ShowStatus" AS ENUM ('WATCHING', 'COMPLETED', 'ON_HOLD', 'DROPPED', 'PLAN_TO_WATCH');

-- CreateTable
CREATE TABLE "Show" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "tvdbId" INTEGER,
    "imdbId" TEXT,
    "title" TEXT NOT NULL,
    "overview" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "status" "ShowStatus" NOT NULL DEFAULT 'PLAN_TO_WATCH',
    "userRating" INTEGER,
    "inWatchlist" BOOLEAN NOT NULL DEFAULT false,
    "firstAirDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeWatch" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "tvdbId" INTEGER,
    "episodeName" TEXT,
    "watched" BOOLEAN NOT NULL DEFAULT true,
    "watchedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogShow" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "tvdbId" INTEGER,
    "imdbId" TEXT,
    "title" TEXT NOT NULL,
    "overview" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "firstAirDate" TEXT,
    "voteAverage" DOUBLE PRECISION,
    "popularity" DOUBLE PRECISION,
    "category" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogShow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "showsAdded" INTEGER NOT NULL DEFAULT 0,
    "episodesAdded" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Show_tmdbId_key" ON "Show"("tmdbId");

-- CreateIndex
CREATE INDEX "Show_status_idx" ON "Show"("status");

-- CreateIndex
CREATE INDEX "Show_inWatchlist_idx" ON "Show"("inWatchlist");

-- CreateIndex
CREATE INDEX "EpisodeWatch_watched_idx" ON "EpisodeWatch"("watched");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeWatch_showId_seasonNumber_episodeNumber_key" ON "EpisodeWatch"("showId", "seasonNumber", "episodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogShow_tmdbId_key" ON "CatalogShow"("tmdbId");

-- CreateIndex
CREATE INDEX "CatalogShow_category_idx" ON "CatalogShow"("category");

-- CreateIndex
CREATE INDEX "CatalogShow_popularity_idx" ON "CatalogShow"("popularity");

-- AddForeignKey
ALTER TABLE "EpisodeWatch" ADD CONSTRAINT "EpisodeWatch_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
