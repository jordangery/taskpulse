// taskpulse - src/app/api/export/route.ts
//
// JSON 匯出 API（features.md ## 8）
// - admin only：靠 requireAdmin
// - taskpulse 本體 dump：users / tasks / progressUpdates / feedbacks
// - 不含 Account / Session（NextAuth 內部用，匯出沒意義）
// - 額外帶 Jira snapshot（如果 admin 已連 Atlassian），給離線備份用
//   - Jira API 撈失敗不擋整包匯出，會在 payload.jira.error 記錄原因

import { requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { fetchTeamJiraIssues } from "@/lib/jira"

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return Response.json({ error: "Forbidden: admin only" }, { status: 403 })
  }

  const [users, tasks, progressUpdates, feedbacks, jiraResult] = await Promise.all([
    prisma.user.findMany(),
    prisma.task.findMany(),
    prisma.progressUpdate.findMany(),
    prisma.feedback.findMany(),
    fetchTeamJiraIssues(),
  ])

  const now = new Date()
  const jiraSnapshot =
    jiraResult.kind === "ok"
      ? { snapshotAt: now.toISOString(), issues: jiraResult.issues }
      : { snapshotAt: now.toISOString(), issues: [], error: jiraResult.kind }

  const payload = {
    exportedAt: now.toISOString(),
    users,
    tasks,
    progressUpdates,
    feedbacks,
    jira: jiraSnapshot,
  }

  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const filename = `taskpulse-export-${yyyy}-${mm}-${dd}.json`

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
