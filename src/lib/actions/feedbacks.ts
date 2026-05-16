"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import {
  ADMIN_QUICK_FEEDBACK_MARKER,
  type FeedbackFormValues,
  feedbackFormSchema,
} from "@/lib/schemas/feedback"

export type FeedbackActionResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string }

export async function createFeedback(
  progressUpdateId: string,
  input: FeedbackFormValues,
): Promise<FeedbackActionResult> {
  const admin = await requireAdmin()
  const parsed = feedbackFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }

  // 找到所屬 task 以便 revalidate
  const pu = await prisma.progressUpdate.findUnique({
    where: { id: progressUpdateId },
    select: { taskId: true },
  })
  if (!pu) return { success: false, error: "找不到該進度" }

  try {
    const fb = await prisma.feedback.create({
      data: {
        progressUpdateId,
        authorId: admin.id,
        content: parsed.data.content,
      },
    })
    revalidatePath(`/tasks/${pu.taskId}`)
    return { success: true, data: { id: fb.id } }
  } catch (e) {
    // schema 上 progressUpdateId 是 @unique，重複 create 觸發 P2002
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "這筆進度已有回饋了" }
    }
    throw e
  }
}

// 快速回饋 for 空任務（沒任何 ProgressUpdate）：
// 一個 transaction 內建一筆「[主管快速回饋]」placeholder progress + Feedback 掛上去
// 不破壞 spec 1對1（每個 ProgressUpdate 仍最多一條 Feedback）
// admin 自己當 author，summary 用 marker 字串方便 UI 之後辨識並換 icon / 標籤
// marker 字串本身放 schemas/feedback.ts，避免 "use server" 檔限制（只能 export async function）
export async function createInitialAdminFeedback(
  taskId: string,
  input: FeedbackFormValues,
): Promise<FeedbackActionResult> {
  const admin = await requireAdmin()
  const parsed = feedbackFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }

  // 確認任務存在 + 沒封存
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, archivedAt: true },
  })
  if (!task) return { success: false, error: "找不到該任務" }
  if (task.archivedAt) return { success: false, error: "任務已封存，無法新增回饋" }

  try {
    const fb = await prisma.$transaction(async (tx) => {
      const update = await tx.progressUpdate.create({
        data: {
          taskId,
          authorId: admin.id,
          summary: ADMIN_QUICK_FEEDBACK_MARKER,
          status: "註記",
        },
      })
      return tx.feedback.create({
        data: {
          progressUpdateId: update.id,
          authorId: admin.id,
          content: parsed.data.content,
        },
      })
    })
    revalidatePath("/tasks")
    revalidatePath(`/tasks/${taskId}`)
    return { success: true, data: { id: fb.id } }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "這個任務已經有快速回饋了" }
    }
    throw e
  }
}

export async function updateFeedback(
  id: string,
  input: FeedbackFormValues,
): Promise<FeedbackActionResult> {
  await requireAdmin()
  const parsed = feedbackFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }

  try {
    const fb = await prisma.feedback.update({
      where: { id },
      data: { content: parsed.data.content },
      select: { id: true, progressUpdate: { select: { taskId: true } } },
    })
    // updatedAt 由 @updatedAt 自動更新
    revalidatePath(`/tasks/${fb.progressUpdate.taskId}`)
    return { success: true, data: { id: fb.id } }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { success: false, error: "找不到該回饋" }
    }
    throw e
  }
}
