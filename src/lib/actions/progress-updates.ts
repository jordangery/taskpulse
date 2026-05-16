"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"
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
    select: { id: true, assigneeId: true, archivedAt: true },
  })
  if (!task) return { success: false, error: "找不到該任務" }
  if (task.archivedAt) return { success: false, error: "任務已封存，無法新增進度" }
  if (me.role !== "admin" && task.assigneeId !== me.id) {
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
  return { success: true, data: { id: created.id } }
}
