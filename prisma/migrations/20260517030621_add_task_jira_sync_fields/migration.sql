-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" DATETIME,
    "completedAt" DATETIME,
    "jiraIssueKey" TEXT,
    "jiraSyncedAt" DATETIME,
    "jiraSyncError" TEXT,
    "jiraSyncAttempts" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("archivedAt", "assigneeId", "completedAt", "createdAt", "creatorId", "description", "dueDate", "id", "title") SELECT "archivedAt", "assigneeId", "completedAt", "createdAt", "creatorId", "description", "dueDate", "id", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_jiraIssueKey_key" ON "Task"("jiraIssueKey");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_archivedAt_idx" ON "Task"("archivedAt");
CREATE INDEX "Task_completedAt_idx" ON "Task"("completedAt");
CREATE INDEX "Task_jiraIssueKey_idx" ON "Task"("jiraIssueKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
