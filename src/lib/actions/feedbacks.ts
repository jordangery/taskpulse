"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { createNotification } from "@/lib/actions/notifications"
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

  // 找到所屬 task + ProgressUpdate.author（用來通知收回饋的人）
  const pu = await prisma.progressUpdate.findUnique({
    where: { id: progressUpdateId },
    select: { taskId: true, authorId: true, task: { select: { title: true } } },
  })
  if (!pu) return { success: false, error: "找不到該進度" }

  let createdId: string
  try {
    const fb = await prisma.feedback.create({
      data: {
        progressUpdateId,
        authorId: admin.id,
        content: parsed.data.content,
      },
    })
    createdId = fb.id
  } catch (e) {
    // schema 上 progressUpdateId 是 @unique，重複 create 觸發 P2002
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "這筆進度已有回饋了" }
    }
    throw e
  }
  revalidatePath(`/tasks/${pu.taskId}`)
  revalidatePath("/tasks")
  // 通知進度的作者（admin 對自己 progress 寫回饋例如 quick feedback 場景不通知自己）
  if (pu.authorId !== admin.id) {
    await createNotification({
      recipientId: pu.authorId,
      type: "feedback_received",
      taskId: pu.taskId,
      message: `${admin.name} 對你在「${pu.task.title}」的進度寫了回饋`,
      link: `/tasks/${pu.taskId}`,
    })
  }
  return { success: true, data: { id: createdId } }
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
    select: { id: true, title: true, assigneeId: true, archivedAt: true },
  })
  if (!task) return { success: false, error: "找不到該任務" }
  if (task.archivedAt) return { success: false, error: "任務已封存，無法新增回饋" }

  let createdId: string
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
    createdId = fb.id
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "這個任務已經有快速回饋了" }
    }
    throw e
  }
  revalidatePath("/tasks")
  revalidatePath(`/tasks/${taskId}`)
  // 通知 task assignee 收到快速回饋（admin 對自己的 task 寫不通知自己）
  if (task.assigneeId !== admin.id) {
    await createNotification({
      recipientId: task.assigneeId,
      type: "feedback_received",
      taskId,
      message: `${admin.name} 對「${task.title}」直接寫了快速回饋`,
      link: `/tasks/${taskId}`,
    })
  }
  return { success: true, data: { id: createdId } }
}

export async function updateFeedback(
  id: string,
  input: FeedbackFormValues,
): Promise<FeedbackActionResult> {
  const admin = await requireAdmin()
  const parsed = feedbackFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }

  let updated: {
    id: string
    progressUpdate: {
      taskId: string
      authorId: string
      task: { title: string }
    }
  }
  try {
    updated = await prisma.feedback.update({
      where: { id },
      data: { content: parsed.data.content },
      select: {
        id: true,
        progressUpdate: {
          select: {
            taskId: true,
            authorId: true,
            task: { select: { title: true } },
          },
        },
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { success: false, error: "找不到該回饋" }
    }
    throw e
  }
  // updatedAt 由 @updatedAt 自動更新
  revalidatePath(`/tasks/${updated.progressUpdate.taskId}`)
  revalidatePath("/tasks")
  // 編輯回饋也通知對方（避免 admin 偷改不被察覺）
  if (updated.progressUpdate.authorId !== admin.id) {
    await createNotification({
      recipientId: updated.progressUpdate.authorId,
      type: "feedback_received",
      taskId: updated.progressUpdate.taskId,
      message: `${admin.name} 修改了在「${updated.progressUpdate.task.title}」上對你的回饋`,
      link: `/tasks/${updated.progressUpdate.taskId}`,
    })
  }
  return { success: true, data: { id: updated.id } }
}
