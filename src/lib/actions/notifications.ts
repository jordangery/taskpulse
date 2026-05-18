"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { fetchMyJiraIssues } from "@/lib/jira"
import { bucketIdFor } from "@/lib/jira-buckets"

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DUE_SOON_THRESHOLD_MS = 1 * MS_PER_DAY // 24 小時內到期 = 快逾期警告

export type NotificationType = "task_assigned" | "feedback_received" | "progress_received"

interface CreateInput {
  recipientId: string
  type: NotificationType
  taskId?: string | null
  message: string
  link: string
}

// 內部 helper：給其他 server action 在事件發生時呼叫
// 不直接 export 是因為 server action 規則要求 export 都是被 client 直接呼叫的、有 CSRF 驗證
// 不過為了 transaction 內共用、這裡仍然 export，呼叫端必須自己有 user gate (requireAdmin etc.)
export async function createNotification({
  recipientId,
  type,
  taskId,
  message,
  link,
}: CreateInput): Promise<void> {
  // 不通知自己：避免 admin 對自己的 task 寫進度也跳通知給自己
  // 由呼叫端判斷 recipientId !== actor.id；這裡只是保險
  await prisma.notification.create({
    data: {
      recipientId,
      type,
      taskId: taskId ?? null,
      message,
      link,
    },
  })
}

// ---- 查詢 / 顯示用 ----

export interface DueWarning {
  taskId: string
  title: string
  dueDate: Date
  link: string
  overdue: boolean
  source: "task" | "jira"
  jiraKey?: string
}

// live 計算：24h 內到期或已逾期的事項，包含：
// 1. taskpulse offline Task（jiraIssueKey IS NULL，避免和下面 Jira 重複）
// 2. Jira 票（assignee=自己 + 非已完成）
// 不寫進 Notification 表（無 cron 環境難避免重複塞）；count 跟列表都靠 query
export async function fetchDueWarnings(userId: string): Promise<DueWarning[]> {
  const now = new Date()
  const horizon = new Date(now.getTime() + DUE_SOON_THRESHOLD_MS)

  const tasksPromise = prisma.task.findMany({
    where: {
      archivedAt: null,
      jiraIssueKey: null,
      dueDate: { lte: horizon, not: null },
      OR: [{ assigneeId: userId }, { creatorId: userId }],
    },
    select: { id: true, title: true, dueDate: true },
    orderBy: { dueDate: "asc" },
  })
  const jiraPromise = fetchMyJiraIssues(userId)

  const [tasks, jira] = await Promise.all([tasksPromise, jiraPromise])

  const warnings: DueWarning[] = tasks
    .filter((t): t is { id: string; title: string; dueDate: Date } => t.dueDate !== null)
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      dueDate: t.dueDate,
      link: `/tasks/${t.id}`,
      overdue: t.dueDate.getTime() < now.getTime(),
      source: "task" as const,
    }))

  if (jira.kind === "ok") {
    for (const issue of jira.issues) {
      if (!issue.dueDate) continue
      if (bucketIdFor(issue.status) === "done") continue
      const due = parseJiraDateKey(issue.dueDate)
      if (!due) continue
      if (due.getTime() > horizon.getTime()) continue
      warnings.push({
        taskId: issue.key, // 借用欄位，UI 端用 source 判斷怎麼處理
        title: issue.summary,
        dueDate: due,
        link: issue.url, // 連到 Jira browse URL
        overdue: due.getTime() < now.getTime(),
        source: "jira",
        jiraKey: issue.key,
      })
    }
  }

  // 依 dueDate 由近到遠排序
  warnings.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  return warnings
}

function parseJiraDateKey(key: string): Date | null {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const date = new Date(y, mo - 1, d, 0, 0, 0, 0)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null
  }
  return date
}

export interface NotificationListItem {
  id: string
  type: string
  message: string
  link: string
  readAt: Date | null
  createdAt: Date
}

export async function fetchMyNotifications(): Promise<{
  unreadCount: number
  recent: NotificationListItem[]
  dueWarnings: DueWarning[]
}> {
  const me = await getCurrentUser().catch(() => null)
  if (!me) return { unreadCount: 0, recent: [], dueWarnings: [] }

  const [recent, unreadCount, dueWarnings] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: me.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        message: true,
        link: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { recipientId: me.id, readAt: null } }),
    fetchDueWarnings(me.id),
  ])

  return { unreadCount: unreadCount + dueWarnings.length, recent, dueWarnings }
}

// ---- 標記已讀 ----

export async function markNotificationRead(id: string): Promise<void> {
  const me = await getCurrentUser()
  await prisma.notification.updateMany({
    where: { id, recipientId: me.id, readAt: null },
    data: { readAt: new Date() },
  })
  revalidatePath("/")
  revalidatePath("/tasks")
}

export async function markAllNotificationsRead(): Promise<void> {
  const me = await getCurrentUser()
  await prisma.notification.updateMany({
    where: { recipientId: me.id, readAt: null },
    data: { readAt: new Date() },
  })
  revalidatePath("/")
  revalidatePath("/tasks")
}
