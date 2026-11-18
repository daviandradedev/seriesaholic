-- Add per-user scoping for library and import data.
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ImportLog" ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ImportJob" ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "Show_tmdbId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Show_userId_tmdbId_key" ON "Show"("userId", "tmdbId");
CREATE INDEX IF NOT EXISTS "Show_userId_idx" ON "Show"("userId");
CREATE INDEX IF NOT EXISTS "ImportLog_userId_idx" ON "ImportLog"("userId");
CREATE INDEX IF NOT EXISTS "ImportJob_userId_idx" ON "ImportJob"("userId");
