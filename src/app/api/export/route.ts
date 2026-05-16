// taskpulse - src/app/api/export/route.ts
//
// JSON 匯出 API（features.md ## 8）
// - admin only：靠 requireAdmin（Day 1 風格，Day 2 NextAuth middleware 接管後依然 work）
// - 整包資料 dump：users / tasks / progressUpdates / feedbacks
// - 不含 Account / Session（NextAuth 內部用，匯出沒意義）

import { requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return Response.json({ error: "Forbidden: admin only" }, { status: 403 })
  }

  const [users, tasks, progressUpdates, feedbacks] = await Promise.all([
    prisma.user.findMany(),
    prisma.task.findMany(),
    prisma.progressUpdate.findMany(),
    prisma.feedback.findMany(),
  ])

  const now = new Date()
  const payload = {
    exportedAt: now.toISOString(),
    users,
    tasks,
    progressUpdates,
    feedbacks,
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
