-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('CREATE_DEPARTMENT', 'CREATE_DOCTOR', 'CREATE_SCHEDULE', 'SUSPEND_SCHEDULE', 'CREATE_APPOINTMENT', 'CANCEL_APPOINTMENT', 'RESCHEDULE_APPOINTMENT', 'CHECKIN', 'CALL_QUEUE', 'SKIP_QUEUE', 'REQUEUE', 'APPROVE_CHANGE_REQUEST', 'REJECT_CHANGE_REQUEST', 'START_APPOINTMENT', 'COMPLETE_APPOINTMENT');

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL,
    "type" "OperationType" NOT NULL,
    "target" TEXT NOT NULL,
    "role" "RoleCode" NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'success',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operation_logs_type_idx" ON "operation_logs"("type");

-- CreateIndex
CREATE INDEX "operation_logs_created_at_idx" ON "operation_logs"("created_at");
