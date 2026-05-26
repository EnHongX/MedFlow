-- AlterEnum
ALTER TYPE "OperationType" ADD VALUE 'CREATE_VISIT_RECORD';

-- CreateTable
CREATE TABLE "visit_records" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "chief_complaint" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "treatment_plan" TEXT NOT NULL,
    "follow_up_recommended" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_dept_id" TEXT,
    "follow_up_doctor_id" TEXT,
    "follow_up_date_start" DATE,
    "follow_up_date_end" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visit_records_appointment_id_key" ON "visit_records"("appointment_id");

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
