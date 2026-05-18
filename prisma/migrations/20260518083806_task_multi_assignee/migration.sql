/*
  Warnings:

  - You are about to drop the column `assigneeId` on the `Task` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("taskId", "userId"),
    CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "creatorId" TEXT NOT NULL,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" DATETIME,
    "completedAt" DATETIME,
    "jiraIssueKey" TEXT,
    "jiraSyncedAt" DATETIME,
    "jiraSyncError" TEXT,
    "jiraSyncAttempts" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("archivedAt", "completedAt", "createdAt", "creatorId", "description", "dueDate", "id", "jiraIssueKey", "jiraSyncAttempts", "jiraSyncError", "jiraSyncedAt", "title") SELECT "archivedAt", "completedAt", "createdAt", "creatorId", "description", "dueDate", "id", "jiraIssueKey", "jiraSyncAttempts", "jiraSyncError", "jiraSyncedAt", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_jiraIssueKey_key" ON "Task"("jiraIssueKey");
CREATE INDEX "Task_archivedAt_idx" ON "Task"("archivedAt");
CREATE INDEX "Task_completedAt_idx" ON "Task"("completedAt");
CREATE INDEX "Task_jiraIssueKey_idx" ON "Task"("jiraIssueKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");
