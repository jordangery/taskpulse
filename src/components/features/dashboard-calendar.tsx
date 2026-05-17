// taskpulse - src/components/features/dashboard-calendar.tsx
//
// Phase B - 28-day mini calendar widget
// Server component (no client state). Hover tooltip 用 Tailwind group-hover 純 SSR 即可
//
// 28 cells grid (4 rows × 7 cols, Mon-Sun aligned)
// - 今天：bg-accent-subtle + ⭐
// - 逾期日（過去 + 有任務）：bg-danger-subtle
// - 過去空格：opacity-60 + text-text-tertiary
// - 未來：text-text-secondary
// - 月份標頭：cell 是該月第 1 天才顯示
// - Hover：列最多 5 個 task title + 等 N 個

import Link from "next/link"
import type { CalendarEvent } from "@/lib/calendar"

interface Props {
  events: CalendarEvent[]
  todayKey: string
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"]
const MAX_TOOLTIP_TASKS = 5
const MAX_DOTS = 3

export function DashboardCalendar({ events, todayKey }: Props) {
  const totalTasks = events.reduce((sum, e) => sum + e.tasks.length, 0)

  return (
    <article className="rounded-md border border-border-subtle bg-surface px-5 py-4">
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-medium text-text-primary">本月日曆</h2>
          <p className="mt-0.5 text-xs text-text-tertiary">
            過去 1 週 + 本週 + 未來 2 週共 28 天｜⭐ 今天｜紅底 逾期
          </p>
        </div>
        <p className="text-xs text-text-tertiary">{totalTasks} 個任務在這 4 週到期</p>
      </header>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-1 text-center text-xs font-medium text-text-tertiary">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {events.map((event) => (
          <CalendarCell
            key={event.date}
            event={event}
            isToday={event.date === todayKey}
            todayKey={todayKey}
          />
        ))}
      </div>

      {totalTasks === 0 && (
        <p className="mt-3 text-center text-xs text-text-tertiary">
          這 4 週沒有任何任務設了截止日 —{" "}
          <Link href="/tasks" className="text-accent hover:text-accent-hover">
            去 /tasks 設一下
          </Link>{" "}
          才會出現在這
        </p>
      )}
    </article>
  )
}

function CalendarCell({
  event,
  isToday,
  todayKey,
}: {
  event: CalendarEvent
  isToday: boolean
  todayKey: string
}) {
  const hasTasks = event.tasks.length > 0
  const isPast = event.date < todayKey
  const isOverdue = isPast && hasTasks && event.tasks.some((t) => t.overdue)
  const parts = event.date.split("-").map(Number)
  const month = parts[1]
  const day = parts[2]
  const isFirstOfMonth = day === 1

  // Cell colour logic (token-only, no hex / gray utilities)
  let cellClass = ""
  let dayTextClass = ""
  if (isToday) {
    cellClass = "bg-accent-subtle border-accent/40"
    dayTextClass = "text-accent font-semibold"
  } else if (isOverdue) {
    cellClass = "bg-danger-subtle border-danger/30"
    dayTextClass = "text-danger font-semibold"
  } else if (isPast) {
    cellClass = "border-border-subtle opacity-60"
    dayTextClass = "text-text-tertiary"
  } else {
    cellClass = "border-border-subtle"
    dayTextClass = "text-text-secondary"
  }

  return (
    <div
      className={`group relative flex h-16 flex-col justify-between rounded-md border px-1.5 py-1 sm:h-12 md:h-16 ${cellClass}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={`text-xs leading-none ${dayTextClass}`}>
          {isFirstOfMonth && <span className="mr-1 text-[10px] text-text-tertiary">{month}月</span>}
          {day}
        </span>
        {isToday && (
          <span role="img" aria-label="今天">
            ⭐
          </span>
        )}
      </div>

      {hasTasks && <CountBadge count={event.tasks.length} isOverdue={isOverdue} />}

      {hasTasks && <Tooltip event={event} />}
    </div>
  )
}

function CountBadge({ count, isOverdue }: { count: number; isOverdue: boolean }) {
  const dots = Math.min(count, MAX_DOTS)
  const dotColorClass = isOverdue ? "bg-danger" : "bg-accent"
  return (
    <div className="flex items-center justify-end gap-0.5">
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: dots }).map((_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: dots are purely decorative
            key={i}
            className={`h-1 w-1 rounded-full ${dotColorClass}`}
          />
        ))}
      </div>
      <span
        className={`text-[10px] leading-none ${isOverdue ? "text-danger" : "text-text-secondary"}`}
      >
        {count}
      </span>
    </div>
  )
}

function Tooltip({ event }: { event: CalendarEvent }) {
  const visible = event.tasks.slice(0, MAX_TOOLTIP_TASKS)
  const extra = event.tasks.length - visible.length

  return (
    <div
      role="tooltip"
      className="pointer-events-none invisible absolute top-full left-1/2 z-10 mt-1 w-48 -translate-x-1/2 rounded-md border border-border-subtle bg-elevated px-3 py-2 text-left opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
    >
      <p className="mb-1 text-[10px] uppercase tracking-wide text-text-tertiary">{event.date}</p>
      <ul className="space-y-1">
        {visible.map((task) => (
          <li key={task.id} className="flex flex-col gap-0.5 text-xs">
            <span className="line-clamp-2 text-text-primary">{task.title}</span>
            <span className="text-[10px] text-text-tertiary">{task.assigneeName}</span>
          </li>
        ))}
      </ul>
      {extra > 0 && <p className="mt-1 text-[10px] text-text-tertiary">等 {extra} 個…</p>}
    </div>
  )
}
