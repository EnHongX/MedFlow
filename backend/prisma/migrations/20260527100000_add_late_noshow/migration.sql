-- AlterEnum: Add NO_SHOW to AppointmentStatus
ALTER TYPE "AppointmentStatus" ADD VALUE 'NO_SHOW';

-- AlterEnum: Add MARK_NO_SHOW to OperationType
ALTER TYPE "OperationType" ADD VALUE 'MARK_NO_SHOW';

-- AlterTable: Add threshold columns to ClinicConfig
ALTER TABLE "clinic_configs"
  ADD COLUMN "late_threshold_minutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "no_show_threshold_minutes" INTEGER NOT NULL DEFAULT 30;
