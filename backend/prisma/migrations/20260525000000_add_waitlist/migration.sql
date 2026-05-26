-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('PENDING', 'PROMOTED', 'CANCELLED', 'CLOSED');

-- Add new operation types
ALTER TYPE "OperationType" ADD VALUE 'WAITLIST_JOIN';
ALTER TYPE "OperationType" ADD VALUE 'WAITLIST_CANCEL';
ALTER TYPE "OperationType" ADD VALUE 'WAITLIST_PROMOTE';
ALTER TYPE "OperationType" ADD VALUE 'WAITLIST_CLOSE';

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'PENDING',
    "position" INTEGER NOT NULL,
    "appointment_id" TEXT,
    "close_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waitlist_entries_schedule_id_status_position_idx" ON "waitlist_entries"("schedule_id", "status", "position");

-- Partial unique index: one PENDING entry per patient+schedule
CREATE UNIQUE INDEX "waitlist_entries_patient_schedule_pending" ON "waitlist_entries" ("patient_id", "schedule_id") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
