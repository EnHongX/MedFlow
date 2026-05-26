-- CreateEnum
CREATE TYPE "ChangeRequestType" AS ENUM ('CANCEL', 'RESCHEDULE');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "clinic_configs" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "cancel_deadline_hours" INTEGER NOT NULL DEFAULT 2,
    "advance_booking_days" INTEGER NOT NULL DEFAULT 7,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "type" "ChangeRequestType" NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "target_schedule_id" TEXT,
    "reason" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_target_schedule_id_fkey" FOREIGN KEY ("target_schedule_id") REFERENCES "schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default config
INSERT INTO "clinic_configs" ("id", "cancel_deadline_hours", "advance_booking_days", "updated_at")
VALUES ('singleton', 2, 7, NOW())
ON CONFLICT DO NOTHING;
