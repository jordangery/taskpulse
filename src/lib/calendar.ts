// taskpulse - src/lib/calendar.ts
//
// 28-day calendar window：上週週一 ~ 下下週週日
//
// 既撈 taskpulse offline Task（jiraIssueKey IS NULL 才算離線記事）也撈 Jira 票
// 兩邊都 normalize 成 CalendarItem，依 local time YYYY-MM-DD key 進對應 bucket
//
// 注意：dueDate 跨時區會出包 → 一律走 local time（getFullYear/getMonth/getDate）
// 避免 UTC 03:00 被算到前一天

import { addDays, startOfDay, startOfWeek } from "date-fns"
import { prisma } from "./db"
import { getTaiwanHolidaysInRange } from "./holidays"
import { fetchMyJiraIssues, fetchTeamJiraIssues, type JiraIssue } from "./jira"
import { bucketIdFor } from "./jira-buckets"

// 統一 calendar 上一格 cell 裡的「事項」格式（不論來自 Task 或 Jira）
export interface CalendarItem {
  id: string // unique within calendar: "task:<cuid>" or "jira:<key>"
  title: string
  assigneeName: string
  overdue: boolean
  // source = 'task' (taskpulse offline 記事) | 'jira'（Jira 票）
  source: "task" | "jira"
  // 只有 source=task 才有：原始 Task primary key（給 drag-drop 改 dueDate 用）
  taskId?: string
  // 只有 source=jira 才有：Jira issue key 與外部 URL
  jiraKey?: string
  url?: string
}

export interface CalendarEvent {
  date: string
  items: CalendarItem[]
  holiday?: string
  // 這天有幾則 calendar note（任意 user 寫的、team 共享）
  // 完整內容在 /calendar/[date] 看；dashboard 只顯示有沒有
  noteCount: number
}

export interface CalendarData {
  events: CalendarEvent[]
  todayKey: string
  startKey: string
}

function toLocalKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export async function fetchCalendarEvents(userId: string, isAdmin: boolean): Promise<CalendarData> {
  const today = startOfDay(new Date())
  const thisWeekMonday = startOfWeek(today, { weekStartsOn: 1 })
  const start = addDays(thisWeekMonday, -7)
  const end = addDays(start, 28)

  // taskpulse Task：只拿「離線記事」(jiraIssueKey IS NULL)；已同步到 Jira 的會在 Jira 那邊出現
  // 避免一張單在 calendar 上重複顯示兩筆
  const taskPromise = prisma.task.findMany({
    where: {
      archivedAt: null,
      jiraIssueKey: null,
      dueDate: { gte: start, lt: end },
      // member 只看自己被指派到的：assignees 內含 userId
      ...(isAdmin ? {} : { assignees: { some: { userId } } }),
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      // 全部 assignees，UI 端組成 "Alice / Bob / Carol" 顯示
      assignees: {
        orderBy: { createdAt: "asc" },
        select: { user: { select: { name: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
  })

  // Jira：admin 用 team token 撈全部、member 撈自己的
  const jiraPromise = isAdmin ? fetchTeamJiraIssues() : fetchMyJiraIssues(userId)

  // 日曆記事：撈這 28 天範圍內所有 note，groupBy dateKey 拿 count
  const startKey = toLocalKey(start)
  const endKey = toLocalKey(addDays(end, -1)) // end 是 exclusive，倒回最後一天
  const notesCountPromise = prisma.calendarNote.groupBy({
    by: ["dateKey"],
    where: { dateKey: { gte: startKey, lte: endKey } },
    _count: { _all: true },
  })

  const [tasks, jira, noteCounts] = await Promise.all([taskPromise, jiraPromise, notesCountPromise])

  const noteCountByDate = new Map<string, number>()
  for (const n of noteCounts) noteCountByDate.set(n.dateKey, n._count._all)

  const buckets = new Map<string, CalendarItem[]>()
  for (let i = 0; i < 28; i++) {
    const d = addDays(start, i)
    buckets.set(toLocalKey(d), [])
  }

  // 塞 taskpulse offline 記事
  for (const t of tasks) {
    if (!t.dueDate) continue
    const key = toLocalKey(t.dueDate)
    const slot = buckets.get(key)
    if (!slot) continue
    // 多 assignee 顯示成 "Alice + 2" 之類
    const names = t.assignees.map((a) => a.user.name)
    const display =
      names.length === 0
        ? "未指派"
        : names.length === 1
          ? names[0]
          : `${names[0]} +${names.length - 1}`
    slot.push({
      id: `task:${t.id}`,
      taskId: t.id,
      title: t.title,
      assigneeName: display,
      overdue: t.dueDate < today,
      source: "task",
    })
  }

  // 塞 Jira 票（done 狀態跳過，不污染 calendar）
  if (jira.kind === "ok") {
    for (const issue of jira.issues) {
      if (!issue.dueDate) continue
      if (bucketIdFor(issue.status) === "done") continue
      // Jira API 的 duedate 是 local YYYY-MM-DD 字串，直接拿來組 Date 做比對
      const due = parseJiraDateKey(issue.dueDate)
      if (!due) continue
      const key = issue.dueDate // 已經是 YYYY-MM-DD 格式
      const slot = buckets.get(key)
      if (!slot) continue
      slot.push({
        id: `jira:${issue.key}`,
        title: issue.summary,
        assigneeName: issue.assigneeName,
        overdue: due < today,
        source: "jira",
        jiraKey: issue.key,
        url: issue.url,
      })
    }
  }

  const holidays = getTaiwanHolidaysInRange(start, end)

  return {
    events: Array.from(buckets.entries()).map(([date, items]) => ({
      date,
      items,
      holiday: holidays.get(date),
      noteCount: noteCountByDate.get(date) ?? 0,
    })),
    todayKey: toLocalKey(today),
    startKey: toLocalKey(start),
  }
}

// "YYYY-MM-DD" → local-time Date（用來跟 today 比 overdue）
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

// 同時 export 給 /calendar/[date] page 用（drill-down 也要 source-aware 顯示）
export type { JiraIssue }
