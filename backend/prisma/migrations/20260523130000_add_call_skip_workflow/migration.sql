-- AlterEnum
ALTER TYPE "QueueStatus" ADD VALUE 'CALLED';
ALTER TYPE "QueueStatus" ADD VALUE 'SKIPPED';
ALTER TYPE "AppointmentStatus" ADD VALUE 'CALLED' AFTER 'CHECKED_IN';

-- CreateTable
CREATE TABLE "queue_skip_logs" (
    "id" TEXT NOT NULL,
    "queue_entry_id" TEXT NOT NULL,
    "original_number" INTEGER NOT NULL,
    "skipped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_skip_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "queue_skip_logs" ADD CONSTRAINT "queue_skip_logs_queue_entry_id_fkey" FOREIGN KEY ("queue_entry_id") REFERENCES "queue_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
