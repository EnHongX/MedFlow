-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'PENDING_FRONTDESK';

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "suspend_reason" TEXT,
ADD COLUMN "suspended_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "cancel_reason" TEXT;
