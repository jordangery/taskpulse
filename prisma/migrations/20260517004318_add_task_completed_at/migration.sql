-- AlterTable
ALTER TABLE "Task" ADD COLUMN "completedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Task_completedAt_idx" ON "Task"("completedAt");
