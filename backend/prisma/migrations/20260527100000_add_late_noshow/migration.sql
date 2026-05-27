-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'NO_SHOW';

-- AlterEnum
ALTER TYPE "OperationType" ADD VALUE 'MARK_NO_SHOW';

-- AlterTable
ALTER TABLE "clinic_configs" ADD COLUMN "late_threshold_minutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "clinic_configs" ADD COLUMN "no_show_threshold_minutes" INTEGER NOT NULL DEFAULT 30;
