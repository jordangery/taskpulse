"use server"

import { revalidatePath } from "next/cache"
import { createNotification } from "@/lib/actions/notifications"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { addJiraComment } from "@/lib/jira"
import {
  type ProgressUpdateFormValues,
  progressUpdateFormSchema,
} from "@/lib/schemas/progress-update"

export type ProgressActionResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string }

export async function createProgressUpdate(
  taskId: string,
  input: ProgressUpdateFormValues,
): Promise<ProgressActionResult> {
  const me = await getCurrentUser()

  const parsed = progressUpdateFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }

  // 確認任務存在 + 角色權限：member 只能在自己被指派的任務寫；admin 任何任務都可寫（代寫）
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      assignees: { select: { userId: true } },
      creatorId: true,
      archivedAt: true,
      jiraIssueKey: true,
    },
  })
  if (!task) return { success: false, error: "找不到該任務" }
  if (task.archivedAt) return { success: false, error: "任務已封存，無法新增進度" }
  const isAssignee = task.assignees.some((a) => a.userId === me.id)
  if (me.role !== "admin" && !isAssignee) {
    return { success: false, error: "你不是這個任務的負責人" }
  }

  // append-only：每次都是新建 row，不動舊紀錄
  const created = await prisma.progressUpdate.create({
    data: {
      taskId,
      authorId: me.id,
      summary: parsed.data.summary,
      percentage:
        parsed.data.percentage && parsed.data.percentage.length > 0
          ? Number(parsed.data.percentage)
          : null,
      status: parsed.data.status && parsed.data.status.length > 0 ? parsed.data.status : null,
    },
  })

  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")

  // Jira sync：task 有對應 issue 就 best-effort 寫一條 comment
  // 失敗只 log（addJiraComment 內部 swallow），不影響 progress 主流程
  if (task.jiraIssueKey) {
    const pct = parsed.data.percentage ? `（${parsed.data.percentage}%）` : ""
    const status = parsed.data.status ? `［${parsed.data.status}］` : ""
    const body = `[taskpulse｜${me.name} 寫進度] ${status}${pct} ${parsed.data.summary}`
    await addJiraComment(task.jiraIssueKey, body)
  }

  // 通知任務建立者（admin）有新進度，但 admin 自己代寫自己 created 的任務不通知自己
  if (task.creatorId !== me.id) {
    const snippet =
      parsed.data.summary.length > 30 ? `${parsed.data.summary.slice(0, 30)}…` : parsed.data.summary
    await createNotification({
      recipientId: task.creatorId,
      type: "progress_received",
      taskId,
      message: `${me.name} 在「${task.title}」寫了新進度：${snippet}`,
      link: `/tasks/${taskId}`,
    })
  }
  return { success: true, data: { id: created.id } }
}
