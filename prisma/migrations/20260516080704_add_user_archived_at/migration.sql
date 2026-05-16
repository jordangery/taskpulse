-- AlterTable
ALTER TABLE "User" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX "User_archivedAt_idx" ON "User"("archivedAt");
