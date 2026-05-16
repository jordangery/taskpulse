-- DropIndex
DROP INDEX "Feedback_progressUpdateId_key";

-- CreateIndex
CREATE INDEX "Feedback_progressUpdateId_createdAt_idx" ON "Feedback"("progressUpdateId", "createdAt");
