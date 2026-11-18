-- AlterTable Show: custom shows + optional tmdbId
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN NOT NULL DEFAULT false;

-- Make tmdbId nullable for custom shows (drop unique, recreate as unique nullable)
ALTER TABLE "Show" ALTER COLUMN "tmdbId" DROP NOT NULL;

-- Local seasons/episodes for custom (and editable) catalogs
CREATE TABLE IF NOT EXISTS "LocalSeason" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalSeason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LocalEpisode" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "airDate" TEXT,
    "runtimeMinutes" INTEGER,
    "stillPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalEpisode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LocalSeason_showId_seasonNumber_key" ON "LocalSeason"("showId", "seasonNumber");
CREATE INDEX IF NOT EXISTS "LocalSeason_showId_idx" ON "LocalSeason"("showId");

CREATE UNIQUE INDEX IF NOT EXISTS "LocalEpisode_seasonId_episodeNumber_key" ON "LocalEpisode"("seasonId", "episodeNumber");
CREATE INDEX IF NOT EXISTS "LocalEpisode_seasonId_idx" ON "LocalEpisode"("seasonId");

DO $$ BEGIN
  ALTER TABLE "LocalSeason" ADD CONSTRAINT "LocalSeason_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LocalEpisode" ADD CONSTRAINT "LocalEpisode_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "LocalSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Remove phantom specials (season 0) that inflate watched counts without appearing in UI
DELETE FROM "EpisodeWatch" WHERE "seasonNumber" < 1;
