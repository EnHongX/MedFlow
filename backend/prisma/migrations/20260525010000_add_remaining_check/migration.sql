-- Prevent remaining from going negative (concurrency safety net)
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_remaining_non_negative" CHECK ("remaining" >= 0);
