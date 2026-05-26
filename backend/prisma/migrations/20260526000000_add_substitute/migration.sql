-- Add new operation type
ALTER TYPE "OperationType" ADD VALUE 'SUBSTITUTE_SCHEDULE';

-- Add substitute fields to schedules
ALTER TABLE "schedules" ADD COLUMN "substituted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "schedules" ADD COLUMN "substitute_reason" TEXT;
ALTER TABLE "schedules" ADD COLUMN "substituted_at" TIMESTAMP(3);
ALTER TABLE "schedules" ADD COLUMN "substituted_to_id" TEXT;

-- Add transfer_reason to appointments
ALTER TABLE "appointments" ADD COLUMN "transfer_reason" TEXT;
