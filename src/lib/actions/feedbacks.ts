"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { createNotification } from "@/lib/actions/notifications"
import { getCurrentUser, requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { addJiraComment } from "@/lib/jira"
import {
  ADMIN_QUICK_FEEDBACK_MARKER,
  type FeedbackFormValues,
  feedbackFormSchema,
} from "@/lib/schemas/feedback"

export type FeedbackActionResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string }

// 通知留言串所有參與者（task creator + progress author + 過往留言作者），actor 自己不收
async function notifyThread(args: {
  taskId: string
  taskTitle: string
  progressAuthorId: string
  taskCreatorId: string
  taskAssigneeId: string
  existingAuthorIds: string[]
  actorId: string
  actorName: string
}) {
  const recipients = new Set<string>()
  recipients.add(args.taskCreatorId)
  recipients.add(args.taskAssigneeId)
  recipients.add(args.progressAuthorId)
  for (const id of args.existingAuthorIds) recipients.add(id)
  recipients.delete(args.actorId)

  const promises: Promise<void>[] = []
  for (const rid of recipients) {
    promises.push(
      createNotification({
        recipientId: rid,
        type: "feedback_received",
        taskId: args.taskId,
        message: `${args.actorName} 在「${args.taskTitle}」回應了你參與的留言串`,
        link: `/tasks/${args.taskId}`,
      }),
    )
  }
  await Promise.all(promises)
}

export async function createFeedback(
  progressUpdateId: string,
  input: FeedbackFormValues,
): Promise<FeedbackActionResult> {
  const me = await getCurrentUser()
  const parsed = feedbackFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }

  const pu = await prisma.progressUpdate.findUnique({
    where: { id: progressUpdateId },
    select: {
      taskId: true,
      authorId: true,
      task: {
        select: {
          title: true,
          assigneeId: true,
          creatorId: true,
          archivedAt: true,
          jiraIssueKey: true,
        },
      },
      feedbacks: { select: { authorId: true }, distinct: ["authorId"] },
    },
  })
  if (!pu) return { success: false, error: "找不到該進度" }
  if (pu.task.archivedAt) return { success: false, error: "任務已封存，無法留言" }

  // 權限：admin / task assignee / task creator / 已參與留言串的人 都可以回
  const hasCommented = pu.feedbacks.some((f) => f.authorId === me.id)
  const canReply =
    me.role === "admin" ||
    me.id === pu.task.assigneeId ||
    me.id === pu.task.creatorId ||
    me.id === pu.authorId ||
    hasCommented
  if (!canReply) {
    return { success: false, error: "你不是這個任務的相關人員" }
  }

  const fb = await prisma.feedback.create({
    data: {
      progressUpdateId,
      authorId: me.id,
      content: parsed.data.content,
    },
  })

  revalidatePath(`/tasks/${pu.taskId}`)
  revalidatePath("/tasks")

  // Jira sync：task 對應 issue 就 best-effort 寫一條 comment
  if (pu.task.jiraIssueKey) {
    const body = `[taskpulse｜${me.name} 回應] ${parsed.data.content}`
    await addJiraComment(pu.task.jiraIssueKey, body)
  }

  await notifyThread({
    taskId: pu.taskId,
    taskTitle: pu.task.title,
    progressAuthorId: pu.authorId,
    taskCreatorId: pu.task.creatorId,
    taskAssigneeId: pu.task.assigneeId,
    existingAuthorIds: pu.feedbacks.map((f) => f.authorId),
    actorId: me.id,
    actorName: me.name,
  })
  return { success: true, data: { id: fb.id } }
}

// 快速回饋 for 空任務（沒任何 ProgressUpdate）：
// admin 建一筆 ghost ProgressUpdate + 第一則留言；之後 member / admin 都可以 reply 接龍
export async function createInitialAdminFeedback(
  taskId: string,
  input: FeedbackFormValues,
): Promise<FeedbackActionResult> {
  const admin = await requireAdmin()
  const parsed = feedbackFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, assigneeId: true, archivedAt: true, jiraIssueKey: true },
  })
  if (!task) return { success: false, error: "找不到該任務" }
  if (task.archivedAt) return { success: false, error: "任務已封存，無法新增回饋" }

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
  // Jira sync：admin 快速回饋寫進 Jira comment（內含主管原句）
  if (task.jiraIssueKey) {
    const body = `[taskpulse｜${admin.name} 主管快速回饋] ${parsed.data.content}`
    await addJiraComment(task.jiraIssueKey, body)
  }
  if (task.assigneeId !== admin.id) {
    await createNotification({
      recipientId: task.assigneeId,
      type: "feedback_received",
      taskId,
      message: `${admin.name} 對「${task.title}」開了快速回饋串`,
      link: `/tasks/${taskId}`,
    })
  }
  return { success: true, data: { id: fb.id } }
}

export async function updateFeedback(
  id: string,
  input: FeedbackFormValues,
): Promise<FeedbackActionResult> {
  const me = await getCurrentUser()
  const parsed = feedbackFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }

  const existing = await prisma.feedback.findUnique({
    where: { id },
    select: { authorId: true, progressUpdateId: true },
  })
  if (!existing) return { success: false, error: "找不到該回應" }
  // 只有 author 自己能編輯（admin 也不能改別人的話）
  if (existing.authorId !== me.id) {
    return { success: false, error: "只有原作者能編輯" }
  }

  let updated: {
    id: string
    progressUpdate: {
      taskId: string
      authorId: string
      task: { title: string; assigneeId: string; creatorId: string }
      feedbacks: { authorId: string }[]
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
            task: { select: { title: true, assigneeId: true, creatorId: true } },
            feedbacks: { select: { authorId: true }, distinct: ["authorId"] },
          },
        },
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { success: false, error: "找不到該回應" }
    }
    throw e
  }
  revalidatePath(`/tasks/${updated.progressUpdate.taskId}`)
  revalidatePath("/tasks")
  // 編輯也通知其他參與者
  await notifyThread({
    taskId: updated.progressUpdate.taskId,
    taskTitle: updated.progressUpdate.task.title,
    progressAuthorId: updated.progressUpdate.authorId,
    taskCreatorId: updated.progressUpdate.task.creatorId,
    taskAssigneeId: updated.progressUpdate.task.assigneeId,
    existingAuthorIds: updated.progressUpdate.feedbacks.map((f) => f.authorId),
    actorId: me.id,
    actorName: me.name,
  })
  return { success: true, data: { id: updated.id } }
}
