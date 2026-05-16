"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { createNotification } from "@/lib/actions/notifications"
import { requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { type TaskFormValues, taskFormSchema } from "@/lib/schemas/task"

export type TaskActionResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string }

// 把 RHF form values 轉成 prisma 寫入用的 shape
function normalizeFormValues(input: TaskFormValues) {
  return {
    title: input.title,
    description: input.description && input.description.length > 0 ? input.description : null,
    assigneeId: input.assigneeId,
    dueDate: input.dueDate && input.dueDate.length > 0 ? new Date(input.dueDate) : null,
  }
}

export async function createTask(input: TaskFormValues): Promise<TaskActionResult> {
  const admin = await requireAdmin()
  const parsed = taskFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }
  let createdId: string
  try {
    const task = await prisma.task.create({
      data: {
        ...normalizeFormValues(parsed.data),
        creatorId: admin.id,
      },
    })
    createdId = task.id
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { success: false, error: "指派的成員不存在" }
    }
    throw e
  }
  revalidatePath("/tasks")
  // 通知被指派的 member（admin 自己指派自己不通知）
  if (parsed.data.assigneeId !== admin.id) {
    await createNotification({
      recipientId: parsed.data.assigneeId,
      type: "task_assigned",
      taskId: createdId,
      message: `${admin.name} 指派任務「${parsed.data.title}」給你`,
      link: `/tasks/${createdId}`,
    })
  }
  return { success: true, data: { id: createdId } }
}

export async function updateTask(id: string, input: TaskFormValues): Promise<TaskActionResult> {
  const admin = await requireAdmin()
  const parsed = taskFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }
  // 先抓舊 assigneeId，看 update 後有沒有換人
  const prev = await prisma.task.findUnique({
    where: { id },
    select: { assigneeId: true },
  })
  if (!prev) return { success: false, error: "找不到該任務" }
  try {
    await prisma.task.update({
      where: { id },
      data: normalizeFormValues(parsed.data),
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") return { success: false, error: "找不到該任務" }
      if (e.code === "P2003") return { success: false, error: "指派的成員不存在" }
    }
    throw e
  }
  revalidatePath("/tasks")
  revalidatePath(`/tasks/${id}`)
  revalidatePath(`/tasks/${id}/edit`)
  // assignee 換人才通知新 assignee
  if (parsed.data.assigneeId !== prev.assigneeId && parsed.data.assigneeId !== admin.id) {
    await createNotification({
      recipientId: parsed.data.assigneeId,
      type: "task_assigned",
      taskId: id,
      message: `${admin.name} 把任務「${parsed.data.title}」轉派給你`,
      link: `/tasks/${id}`,
    })
  }
  return { success: true, data: { id } }
}

export async function archiveTask(id: string): Promise<void> {
  await requireAdmin()
  await prisma.task.update({ where: { id }, data: { archivedAt: new Date() } })
  revalidatePath("/tasks")
  revalidatePath(`/tasks/${id}`)
}

export async function unarchiveTask(id: string): Promise<void> {
  await requireAdmin()
  await prisma.task.update({ where: { id }, data: { archivedAt: null } })
  revalidatePath("/tasks")
  revalidatePath(`/tasks/${id}`)
}
