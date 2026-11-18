-- AlterTable
ALTER TABLE "EpisodeWatch" ADD COLUMN IF NOT EXISTS "runtimeMinutes" INTEGER;

-- AlterTable
ALTER TABLE "ImportLog" ADD COLUMN IF NOT EXISTS "episodesSkipped" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImportLogShow" (
    "id" TEXT NOT NULL,
    "importLogId" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "title" TEXT NOT NULL,
    "posterPath" TEXT,
    "episodesAdded" INTEGER NOT NULL DEFAULT 0,
    "isNew" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ImportLogShow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportLogShow_importLogId_idx" ON "ImportLogShow"("importLogId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ImportLogShow" ADD CONSTRAINT "ImportLogShow_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "ImportLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
