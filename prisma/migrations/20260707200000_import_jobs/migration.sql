-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ImportJobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImportJob" (
    "id" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'RUNNING',
    "phase" TEXT NOT NULL DEFAULT 'parsing',
    "current" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "format" TEXT,
    "filesProcessed" TEXT,
    "importLogId" TEXT,
    "error" TEXT,
    "statsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportJob_status_idx" ON "ImportJob"("status");
CREATE INDEX IF NOT EXISTS "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");
