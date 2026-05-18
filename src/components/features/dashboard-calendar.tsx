// taskpulse - src/components/features/dashboard-calendar.tsx
//
// Phase B + C + E + F + G mini calendar widget (client component)
//
// Phase B：28 cells grid（4 列 × 7 欄、週一週日對齊）顏色 cue：⭐ 今天 / 紅底 逾期 / 過去 fade
// Phase C：每格右上角日期數字是 Link → /calendar/YYYY-MM-DD
// Phase E：每格底部顯示台灣假日名（如有），text-info / text-[10px]
// Phase F：tooltip 內 task 可拖 → 拖到任一 cell 改 dueDate
// Phase G：月（28 天）/ 週（7 天）view toggle
//
// 三個 UI 衝突的處理（記錄給 future maintainer）：
//   * cell 本身同時要：(a) drill-down (b) drop target (c) draggable source 不適合
//     → 改成「右上角日期數字」當 drill Link，cell body 不再 onClick drill；cell 是 drop target
//     → draggable 綁在 tooltip 內的 task title，不綁 cell 本體
//   * tooltip 預設 group-hover 才顯示，但 drag 過程 cursor 離開 source cell 會讓 tooltip 消失
//     → 改成「點 cell 切換 tooltip 開啟」，用 React state（openTooltipDate）
//     → tooltip 一旦打開就不會因 hover 消失，drag 完仍可關閉
//   * Tooltip 本來「pointer-events-none」會讓內部 task 不能拖 → 改 pointer-events-auto
//
// Token-only: 不可出現 hex / bg-white / bg-gray-*

"use client"

import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState, useTransition } from "react"
import { updateTaskDueDate } from "@/lib/actions/tasks"
import type { CalendarEvent, CalendarItem } from "@/lib/calendar"

interface Props {
  events: CalendarEvent[]
  todayKey: string
}

type ViewMode = "month" | "week"

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"]
const MAX_TOOLTIP_TASKS = 5
const MAX_DOTS = 3
const DRAG_MIME = "text/plain"

function parseLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

// 從 todayKey 找「本週週一」的 dateKey（events 已經 Mon-Sun aligned、整段為 4 週）
// 如果 todayKey 不在 events 範圍內（理論上不會）回傳 events[7]?.date 或 events[0]?.date
function findWeekViewStartIndex(events: CalendarEvent[], todayKey: string): number {
  const todayIdx = events.findIndex((e) => e.date === todayKey)
  if (todayIdx === -1) return 7
  // 對應週的週一 = 把 todayIdx 對齊到當週的第 0 個
  return Math.floor(todayIdx / 7) * 7
}

export function DashboardCalendar({ events, todayKey }: Props) {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>("month")
  const [openTooltipDate, setOpenTooltipDate] = useState<string | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [hoverDropDate, setHoverDropDate] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const totalTasks = events.reduce((sum, e) => sum + e.items.length, 0)

  const weekStartIdx = findWeekViewStartIndex(events, todayKey)
  const visibleEvents = view === "month" ? events : events.slice(weekStartIdx, weekStartIdx + 7)

  const weekRangeLabel = (() => {
    if (visibleEvents.length === 0) return ""
    const first = parseLocalDate(visibleEvents[0].date)
    const last = parseLocalDate(visibleEvents[visibleEvents.length - 1].date)
    return `${format(first, "M/d", { locale: zhTW })}–${format(last, "M/d", { locale: zhTW })}`
  })()

  const handleDrop = useCallback(
    (targetDateKey: string, taskId: string) => {
      setHoverDropDate(null)
      setDraggingTaskId(null)
      setOpenTooltipDate(null)
      setErrorMsg(null)
      startTransition(async () => {
        const result = await updateTaskDueDate(taskId, targetDateKey)
        if (!result.success) {
          setErrorMsg(result.error)
          return
        }
        router.refresh()
      })
    },
    [router],
  )

  const handleCellClick = useCallback((dateKey: string) => {
    // 切換 tooltip：再點同一格就關
    setOpenTooltipDate((prev) => (prev === dateKey ? null : dateKey))
  }, [])

  return (
    <article className="rounded-md border border-border-subtle bg-surface px-5 py-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-text-primary">本月日曆</h2>
          <p className="mt-0.5 text-xs text-text-tertiary">
            {view === "month"
              ? "過去 1 週 + 本週 + 未來 2 週共 28 天｜⭐ 今天｜紅底 逾期｜拖任務改截止日"
              : `本週（${weekRangeLabel}）｜⭐ 今天｜紅底 逾期｜拖任務改截止日`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-text-tertiary">
            {view === "month"
              ? `${totalTasks} 個任務在這 4 週到期`
              : `${visibleEvents.reduce((s, e) => s + e.items.length, 0)} 個任務本週到期`}
          </p>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </header>

      {errorMsg && (
        <p className="mb-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-1.5 text-xs text-danger">
          {errorMsg}
        </p>
      )}

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-1 text-center text-xs font-medium text-text-tertiary">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {visibleEvents.map((event) => (
          <CalendarCell
            key={event.date}
            event={event}
            isToday={event.date === todayKey}
            todayKey={todayKey}
            isTooltipOpen={openTooltipDate === event.date}
            isDropHover={hoverDropDate === event.date}
            draggingTaskId={draggingTaskId}
            onCellClick={handleCellClick}
            onTaskDragStart={setDraggingTaskId}
            onTaskDragEnd={() => setDraggingTaskId(null)}
            onDropOnCell={handleDrop}
            onDropHover={setHoverDropDate}
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

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const baseBtn =
    "px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  return (
    <fieldset className="inline-flex overflow-hidden rounded-md border border-border-subtle p-0">
      <legend className="sr-only">切換顯示範圍</legend>
      <button
        type="button"
        onClick={() => onChange("month")}
        aria-pressed={view === "month"}
        className={`${baseBtn} ${
          view === "month"
            ? "bg-accent-subtle text-accent"
            : "bg-surface text-text-secondary hover:bg-subtle"
        }`}
      >
        月
      </button>
      <button
        type="button"
        onClick={() => onChange("week")}
        aria-pressed={view === "week"}
        className={`${baseBtn} border-l border-border-subtle ${
          view === "week"
            ? "bg-accent-subtle text-accent"
            : "bg-surface text-text-secondary hover:bg-subtle"
        }`}
      >
        週
      </button>
    </fieldset>
  )
}

interface CellProps {
  event: CalendarEvent
  isToday: boolean
  todayKey: string
  isTooltipOpen: boolean
  isDropHover: boolean
  draggingTaskId: string | null
  onCellClick: (dateKey: string) => void
  onTaskDragStart: (taskId: string) => void
  onTaskDragEnd: () => void
  onDropOnCell: (dateKey: string, taskId: string) => void
  onDropHover: (dateKey: string | null) => void
}

function CalendarCell({
  event,
  isToday,
  todayKey,
  isTooltipOpen,
  isDropHover,
  draggingTaskId,
  onCellClick,
  onTaskDragStart,
  onTaskDragEnd,
  onDropOnCell,
  onDropHover,
}: CellProps) {
  const hasTasks = event.items.length > 0
  const isPast = event.date < todayKey
  const isOverdue = isPast && hasTasks && event.items.some((t) => t.overdue)
  const parts = event.date.split("-").map(Number)
  const month = parts[1]
  const day = parts[2]
  const isFirstOfMonth = day === 1

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

  const dropRing = isDropHover ? "ring-2 ring-accent" : ""

  return (
    // biome-ignore lint/a11y/useSemanticElements: 需要 drop target + 內含 Link，<button> 無法包 <a>
    <div
      className={`group relative flex h-16 flex-col justify-between rounded-md border px-1.5 py-1 transition-shadow hover:border-border-default sm:h-12 md:h-16 ${cellClass} ${dropRing}`}
      role="button"
      tabIndex={hasTasks ? 0 : -1}
      aria-label={
        hasTasks ? `${event.date}，${event.items.length} 個任務，點擊展開` : `${event.date}，無任務`
      }
      aria-expanded={isTooltipOpen}
      aria-disabled={!hasTasks}
      onDragOver={(e) => {
        // 允許 drop
        e.preventDefault()
        if (draggingTaskId) onDropHover(event.date)
      }}
      onDragEnter={(e) => {
        e.preventDefault()
      }}
      onDragLeave={(e) => {
        // 只在離開整個 cell（含子元素）時清掉
        const related = e.relatedTarget as Node | null
        if (related && e.currentTarget.contains(related)) return
        onDropHover(null)
      }}
      onDrop={(e) => {
        e.preventDefault()
        const taskId = e.dataTransfer.getData(DRAG_MIME)
        if (!taskId) return
        onDropOnCell(event.date, taskId)
      }}
      onClick={(e) => {
        // 排除：點到 Link（日期數字、empty-state link）或 tooltip 內元素
        const target = e.target as HTMLElement
        if (target.closest("a") || target.closest("[data-tooltip-root]")) return
        if (!hasTasks) return
        onCellClick(event.date)
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && hasTasks) {
          e.preventDefault()
          onCellClick(event.date)
        } else if (e.key === "Escape") {
          if (isTooltipOpen) onCellClick(event.date) // 再點一次 = 關閉
        }
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/calendar/${event.date}`}
          onClick={(e) => e.stopPropagation()}
          className={`text-xs leading-none ${dayTextClass} rounded-sm hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
          aria-label={`${event.date} 詳細`}
        >
          {isFirstOfMonth && <span className="mr-1 text-[10px] text-text-tertiary">{month}月</span>}
          {day}
        </Link>
        <div className="flex items-center gap-0.5">
          {event.noteCount > 0 && (
            <span
              role="img"
              aria-label={`${event.noteCount} 則記事`}
              className="text-[10px]"
              title={`${event.noteCount} 則記事`}
            >
              📌
            </span>
          )}
          {isToday && (
            <span role="img" aria-label="今天">
              ⭐
            </span>
          )}
        </div>
      </div>

      {event.holiday && (
        <span className="line-clamp-1 text-[10px] leading-tight text-info" title={event.holiday}>
          {event.holiday}
        </span>
      )}

      {hasTasks && <CountBadge count={event.items.length} isOverdue={isOverdue} />}

      {hasTasks && isTooltipOpen && (
        <Tooltip
          event={event}
          draggingTaskId={draggingTaskId}
          onTaskDragStart={onTaskDragStart}
          onTaskDragEnd={onTaskDragEnd}
        />
      )}
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

function Tooltip({
  event,
  draggingTaskId,
  onTaskDragStart,
  onTaskDragEnd,
}: {
  event: CalendarEvent
  draggingTaskId: string | null
  onTaskDragStart: (taskId: string) => void
  onTaskDragEnd: () => void
}) {
  const visible = event.items.slice(0, MAX_TOOLTIP_TASKS)
  const extra = event.items.length - visible.length

  return (
    <div
      data-tooltip-root
      role="tooltip"
      className="absolute top-full left-1/2 z-10 mt-1 w-48 -translate-x-1/2 rounded-md border border-border-subtle bg-elevated px-3 py-2 text-left shadow-md"
    >
      <p className="mb-1 text-[10px] uppercase tracking-wide text-text-tertiary">{event.date}</p>
      <ul className="space-y-1">
        {visible.map((item) => (
          <TooltipItem
            key={item.id}
            item={item}
            isDragging={draggingTaskId === item.taskId}
            onTaskDragStart={onTaskDragStart}
            onTaskDragEnd={onTaskDragEnd}
          />
        ))}
      </ul>
      {extra > 0 && <p className="mt-1 text-[10px] text-text-tertiary">等 {extra} 個…</p>}
    </div>
  )
}

// Tooltip 內單筆事項：
//   source=task → 可拖（改 dueDate），標「離線」
//   source=jira → 不可拖（要去 Jira 編），點開外部 Jira URL，標 issue key
function TooltipItem({
  item,
  isDragging,
  onTaskDragStart,
  onTaskDragEnd,
}: {
  item: CalendarItem
  isDragging: boolean
  onTaskDragStart: (taskId: string) => void
  onTaskDragEnd: () => void
}) {
  if (item.source === "task" && item.taskId) {
    const taskId = item.taskId
    return (
      <li
        className={`flex cursor-grab flex-col gap-0.5 rounded-sm text-xs active:cursor-grabbing ${
          isDragging ? "opacity-50" : "hover:bg-subtle"
        }`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, taskId)
          e.dataTransfer.effectAllowed = "move"
          onTaskDragStart(taskId)
        }}
        onDragEnd={() => onTaskDragEnd()}
        title="拖到其他格子改截止日"
      >
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-warning-subtle px-1 text-[9px] text-warning">離線</span>
          <span className="line-clamp-2 flex-1 text-text-primary">{item.title}</span>
        </div>
        <span className="text-[10px] text-text-tertiary">{item.assigneeName}</span>
      </li>
    )
  }
  // Jira issue
  return (
    <li className="flex flex-col gap-0.5 rounded-sm text-xs hover:bg-subtle">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1"
        title="開啟 Jira"
      >
        <span className="rounded-full bg-success-subtle px-1 font-mono text-[9px] text-success">
          {item.jiraKey ?? "JIRA"}
        </span>
        <span className="line-clamp-2 flex-1 text-text-primary">{item.title}</span>
      </a>
      <span className="text-[10px] text-text-tertiary">{item.assigneeName}</span>
    </li>
  )
}
