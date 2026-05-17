// taskpulse - src/lib/calendar.ts
//
// Server-only helper for the dashboard calendar widget (Phase B)
// 28-day window (Mon-Sun aligned): 上週週一 ~ 下下週週日
//
// 使用 startOfWeek({ weekStartsOn: 1 }) 找 today 所在週的週一，再倒退 1 週為 start
// 28 個 bucket 全部 pre-seed 為空陣列，再把 task 依 local time 的 YYYY-MM-DD key 放進去
//
// 注意：dueDate 是 DateTime，比較 / key 都走 local time（getFullYear/getMonth/getDate）
// 避免跨時區把任務算到隔天去

import { addDays, startOfDay, startOfWeek } from "date-fns"
import { prisma } from "./db"
import { getTaiwanHolidaysInRange } from "./holidays"

export interface CalendarTask {
  id: string
  title: string
  assigneeName: string
  overdue: boolean
}

export interface CalendarEvent {
  date: string
  tasks: CalendarTask[]
  holiday?: string
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
  // weekStartsOn: 1 = Monday
  const thisWeekMonday = startOfWeek(today, { weekStartsOn: 1 })
  const start = addDays(thisWeekMonday, -7)
  const end = addDays(start, 28)

  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
      dueDate: { gte: start, lt: end },
      ...(isAdmin ? {} : { assigneeId: userId }),
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assignee: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
  })

  const buckets = new Map<string, CalendarTask[]>()
  for (let i = 0; i < 28; i++) {
    const d = addDays(start, i)
    buckets.set(toLocalKey(d), [])
  }

  for (const t of tasks) {
    if (!t.dueDate) continue
    const key = toLocalKey(t.dueDate)
    const slot = buckets.get(key)
    if (!slot) continue
    slot.push({
      id: t.id,
      title: t.title,
      assigneeName: t.assignee.name,
      overdue: t.dueDate < today,
    })
  }

  const holidays = getTaiwanHolidaysInRange(start, end)

  return {
    events: Array.from(buckets.entries()).map(([date, tasks]) => ({
      date,
      tasks,
      holiday: holidays.get(date),
    })),
    todayKey: toLocalKey(today),
    startKey: toLocalKey(start),
  }
}
