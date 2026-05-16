"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { type FeedbackFormValues, feedbackFormSchema } from "@/lib/schemas/feedback"

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
