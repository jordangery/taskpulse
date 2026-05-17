"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { createNotification } from "@/lib/actions/notifications"
import { getCurrentUser, requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { createJiraIssueFromTask, transitionJiraIssue, updateJiraIssueFromTask } from "@/lib/jira"
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
  // taskpulse 是 source of truth — task 已建好，Jira sync 失敗也不 rollback
  await syncTaskToJira(createdId)
  revalidatePath("/tasks")
  revalidatePath("/")
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

// 把 taskpulse task 編輯後的新值 PUT 到既有的 Jira issue
// assigneeChanged 才會帶 assigneeEmail（少打一次 user/search lookup）
async function pushTaskUpdateToJira(
  taskId: string,
  issueKey: string,
  assigneeChanged: boolean,
): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      title: true,
      description: true,
      dueDate: true,
      assignee: { select: { email: true } },
    },
  })
  if (!task) return

  const result = await updateJiraIssueFromTask({
    issueKey,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    assigneeEmail: assigneeChanged ? task.assignee.email : undefined,
  })

  if (result.kind === "ok") {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        jiraSyncedAt: new Date(),
        jiraSyncError: null,
        jiraSyncAttempts: { increment: 1 },
      },
    })
  } else {
    const msg =
      result.kind === "not_configured"
        ? "Jira 整合尚未設定"
        : result.kind === "not_connected"
          ? "Admin 還沒連結 Atlassian"
          : result.message
    await prisma.task.update({
      where: { id: taskId },
      data: {
        jiraSyncError: msg,
        jiraSyncAttempts: { increment: 1 },
      },
    })
  }
}

// 推一筆 task 到 Jira 並寫回 sync state（成功 → jiraIssueKey/jiraSyncedAt；失敗 → jiraSyncError）
// 不丟例外（呼叫端拿不到結果但能照常 revalidate）
async function syncTaskToJira(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      title: true,
      description: true,
      dueDate: true,
      jiraIssueKey: true,
      assignee: { select: { email: true } },
    },
  })
  if (!task) return
  if (task.jiraIssueKey) return // 已同步過，避免重複建

  const result = await createJiraIssueFromTask({
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    assigneeEmail: task.assignee.email,
  })

  if (result.kind === "ok") {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        jiraIssueKey: result.issueKey,
        jiraSyncedAt: new Date(),
        jiraSyncError: null,
        jiraSyncAttempts: { increment: 1 },
      },
    })
  } else {
    // not_configured / not_connected / error — 都記成 pending 狀態
    const msg =
      result.kind === "not_configured"
        ? "Jira 整合尚未設定"
        : result.kind === "not_connected"
          ? "Admin 還沒連結 Atlassian"
          : result.message
    await prisma.task.update({
      where: { id: taskId },
      data: {
        jiraSyncError: msg,
        jiraSyncAttempts: { increment: 1 },
      },
    })
  }
}

// 重試所有未同步的 task（jiraIssueKey IS NULL AND archivedAt IS NULL）
// 從 dashboard banner 觸發；admin only；序列執行避免一次打爆 Jira API
export async function retryJiraSyncAll(): Promise<{ tried: number; ok: number; failed: number }> {
  await requireAdmin()
  const pending = await prisma.task.findMany({
    where: { jiraIssueKey: null, archivedAt: null },
    select: { id: true },
  })
  let ok = 0
  let failed = 0
  for (const t of pending) {
    await syncTaskToJira(t.id)
    const after = await prisma.task.findUnique({
      where: { id: t.id },
      select: { jiraIssueKey: true },
    })
    if (after?.jiraIssueKey) ok++
    else failed++
  }
  revalidatePath("/tasks")
  revalidatePath("/")
  return { tried: pending.length, ok, failed }
}

// 單筆重試（task 詳情頁觸發；form 直接 .bind(null, id)，回 void）
export async function retryJiraSync(taskId: string): Promise<void> {
  await requireAdmin()
  await syncTaskToJira(taskId)
  revalidatePath("/tasks")
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/")
}

export async function updateTask(id: string, input: TaskFormValues): Promise<TaskActionResult> {
  const admin = await requireAdmin()
  const parsed = taskFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }
  // 先抓舊 assigneeId + jiraIssueKey，看 update 後要 PUT 已存在的 issue 還是 POST 新的
  const prev = await prisma.task.findUnique({
    where: { id },
    select: { assigneeId: true, jiraIssueKey: true },
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
  // Jira sync：
  // - 已同步過（有 jiraIssueKey）→ PUT 改 Jira
  // - 從未成功同步 → 重新嘗試 POST（等同 retry）
  // - 失敗都只記 jiraSyncError，不擋 taskpulse update
  if (prev.jiraIssueKey) {
    await pushTaskUpdateToJira(id, prev.jiraIssueKey, prev.assigneeId !== parsed.data.assigneeId)
  } else {
    await syncTaskToJira(id)
  }
  revalidatePath("/tasks")
  revalidatePath(`/tasks/${id}`)
  revalidatePath(`/tasks/${id}/edit`)
  revalidatePath("/")
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

export async function closeTask(id: string): Promise<void> {
  await requireAdmin()
  const task = await prisma.task.update({
    where: { id },
    data: { completedAt: new Date() },
    select: { jiraIssueKey: true },
  })
  if (task.jiraIssueKey) await syncJiraTransitionFor(id, task.jiraIssueKey, "close")
  revalidatePath("/tasks")
  revalidatePath(`/tasks/${id}`)
  revalidatePath("/")
}

export async function reopenTask(id: string): Promise<void> {
  await requireAdmin()
  const task = await prisma.task.update({
    where: { id },
    data: { completedAt: null },
    select: { jiraIssueKey: true },
  })
  if (task.jiraIssueKey) await syncJiraTransitionFor(id, task.jiraIssueKey, "reopen")
  revalidatePath("/tasks")
  revalidatePath(`/tasks/${id}`)
  revalidatePath("/")
}

// 推 transition 到 Jira；結果寫回 jiraSyncedAt / jiraSyncError
async function syncJiraTransitionFor(
  taskId: string,
  issueKey: string,
  direction: "close" | "reopen",
): Promise<void> {
  const result = await transitionJiraIssue(issueKey, direction)
  if (result.kind === "ok") {
    await prisma.task.update({
      where: { id: taskId },
      data: { jiraSyncedAt: new Date(), jiraSyncError: null, jiraSyncAttempts: { increment: 1 } },
    })
  } else {
    const msg =
      result.kind === "not_configured"
        ? "Jira 整合尚未設定"
        : result.kind === "not_connected"
          ? "Admin 還沒連結 Atlassian"
          : result.message
    await prisma.task.update({
      where: { id: taskId },
      data: { jiraSyncError: msg, jiraSyncAttempts: { increment: 1 } },
    })
  }
}

// Phase F - dashboard calendar drag-drop 用：把任務 dueDate 改成 dateKey 當天零點 (local time)
// 權限：admin 可以拖任何任務；member 只能拖自己被指派的（assigneeId === me.id）
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export async function updateTaskDueDate(
  taskId: string,
  newDueDateKey: string,
): Promise<TaskActionResult> {
  if (!DATE_KEY_PATTERN.test(newDueDateKey)) {
    return { success: false, error: "日期格式錯誤" }
  }
  const me = await getCurrentUser()
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, assigneeId: true, archivedAt: true, jiraIssueKey: true },
  })
  if (!task) return { success: false, error: "找不到該任務" }
  if (task.archivedAt) return { success: false, error: "該任務已封存" }
  if (me.role !== "admin" && task.assigneeId !== me.id) {
    return { success: false, error: "沒有權限變更這個任務" }
  }

  // local time 零點：用 Date(y, m-1, d) 而非 ISO 字串，避免 UTC 偏移把日期偏移到前/後一天
  const [y, m, d] = newDueDateKey.split("-").map(Number)
  const newDueDate = new Date(y, m - 1, d, 0, 0, 0, 0)
  // 二次驗證日期合法（例如 2026-02-30 自動 roll 到 3 月）
  if (
    newDueDate.getFullYear() !== y ||
    newDueDate.getMonth() !== m - 1 ||
    newDueDate.getDate() !== d
  ) {
    return { success: false, error: "日期不存在" }
  }

  await prisma.task.update({ where: { id: taskId }, data: { dueDate: newDueDate } })
  // Jira sync：dueDate 變動推到 Jira（只更新 duedate 欄位）
  if (task.jiraIssueKey) {
    const result = await updateJiraIssueFromTask({
      issueKey: task.jiraIssueKey,
      dueDate: newDueDate,
    })
    await prisma.task.update({
      where: { id: taskId },
      data:
        result.kind === "ok"
          ? { jiraSyncedAt: new Date(), jiraSyncError: null, jiraSyncAttempts: { increment: 1 } }
          : {
              jiraSyncError:
                result.kind === "error"
                  ? result.message
                  : result.kind === "not_configured"
                    ? "Jira 整合尚未設定"
                    : "Admin 還沒連結 Atlassian",
              jiraSyncAttempts: { increment: 1 },
            },
    })
  }
  revalidatePath("/")
  revalidatePath("/tasks")
  revalidatePath(`/tasks/${taskId}`)
  return { success: true, data: { id: taskId } }
}
