-- AlterEnum
ALTER TYPE "ImportJobStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN "cancelRequested" BOOLEAN NOT NULL DEFAULT false;
