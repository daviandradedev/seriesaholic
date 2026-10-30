ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "titleEn" TEXT;
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "overviewEn" TEXT;
ALTER TABLE "CatalogShow" ADD COLUMN IF NOT EXISTS "titleEn" TEXT;
ALTER TABLE "CatalogShow" ADD COLUMN IF NOT EXISTS "overviewEn" TEXT;

DELETE FROM "Show" WHERE "userId" LIKE 'guest\_%';
DELETE FROM "ImportLog" WHERE "userId" LIKE 'guest\_%';
DELETE FROM "ImportJob" WHERE "userId" LIKE 'guest\_%';
