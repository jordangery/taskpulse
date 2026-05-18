// taskpulse - src/app/calendar/[date]/page.tsx
//
// Phase C - calendar drill-down
// Route: /calendar/YYYY-MM-DD
//
// 從 dashboard mini calendar 點一格進來，列出該日（local time）所有 dueDate 落在當天的 task
// - admin 看全隊；member 只看自己 assigneeId 的
// - archived task 不顯示（跟 dashboard widget 一致）
// - completed task 顯示但 opacity-60 + ✓ 已結案（跟 /tasks 列表一樣）
// - 日期格式不合法 → notFound()，不做 redirect（無從推測使用者本來想看哪一天）
//
// 日期 key 處理：跟 src/lib/calendar.ts toLocalKey() 一致，用 local time 的 Y/M/D 比對
// query 範圍用 [startOfDay, startOfDay + 1 day) 就足夠（dueDate 是 DateTime，但 UX 上以日為單位）

import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarEventSection } from "@/components/features/calendar-event-section"
import { CalendarNoteSection } from "@/components/features/calendar-note-section"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { fetchMyJiraIssues, fetchTeamJiraIssues, type JiraIssue } from "@/lib/jira"
import { bucketDefFor, bucketIdFor } from "@/lib/jira-buckets"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

interface PageProps {
  params: Promise<{ date: string }>
}

function parseDateKey(dateKey: string): Date | null {
  if (!DATE_PATTERN.test(dateKey)) return null
  const [y, m, d] = dateKey.split("-").map(Number)
  // local time（month 是 0-indexed）
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0)
  // 驗證：例如 2026-02-30 會自動 roll 到 3 月，要剔除
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null
  }
  return dt
}

function relativeLabel(target: Date, today: Date): string {
  const ms = target.getTime() - today.getTime()
  const days = Math.round(ms / (24 * 60 * 60 * 1000))
  if (days === 0) return "今天"
  if (days === 1) return "明天"
  if (days === -1) return "昨天"
  if (days > 0) return `未來 ${days} 天`
  return `過去 ${-days} 天`
}

export default async function CalendarDatePage({ params }: PageProps) {
  const { date: dateKey } = await params
  const target = parseDateKey(dateKey)
  if (!target) notFound()

  const me = await getCurrentUser()
  const isAdmin = me.role === "admin"

  // local-day 範圍：[target, target + 1 day)
  const nextDay = new Date(target)
  nextDay.setDate(nextDay.getDate() + 1)

  // taskpulse offline 記事（沒同步到 Jira 的才在這顯示，避免和下面 Jira 列表重複）
  const taskPromise = prisma.task.findMany({
    where: {
      archivedAt: null,
      jiraIssueKey: null,
      dueDate: { gte: target, lt: nextDay },
      ...(isAdmin ? {} : { assignees: { some: { userId: me.id } } }),
    },
    orderBy: [{ completedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    include: {
      assignees: {
        orderBy: { createdAt: "asc" },
        select: { user: { select: { id: true, name: true } } },
      },
      creator: { select: { id: true, name: true } },
      updates: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { id: true, summary: true, status: true, createdAt: true },
      },
    },
  })
  const jiraPromise = isAdmin ? fetchTeamJiraIssues() : fetchMyJiraIssues(me.id)
  const notesPromise = prisma.calendarNote.findMany({
    where: { dateKey },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      authorId: true,
      author: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  })
  // 事件：startDate <= 當天 <= endDate（跨天事件也算）
  const eventsPromise = prisma.event.findMany({
    where: { startDate: { lte: nextDay }, endDate: { gte: target } },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      startDate: true,
      endDate: true,
      creatorId: true,
      creator: { select: { id: true, name: true } },
      participants: {
        select: { user: { select: { id: true, name: true } } },
      },
    },
  })
  // 給 event form 用的成員 candidate（按 role 排）
  const candidatesPromise = prisma.user.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })
  const [tasks, jiraResult, notes, events, candidates] = await Promise.all([
    taskPromise,
    jiraPromise,
    notesPromise,
    eventsPromise,
    candidatesPromise,
  ])

  // 只挑 dueDate 落在當天 + 非已完成的 Jira 票
  const jiraIssues: JiraIssue[] =
    jiraResult.kind === "ok"
      ? jiraResult.issues.filter((i) => i.dueDate === dateKey && bucketIdFor(i.status) !== "done")
      : []

  // 用於相對標籤的「今天」也走 local time、startOfDay
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekday = format(target, "EEEE", { locale: zhTW })
  const dateTitle = `${target.getFullYear()}/${target.getMonth() + 1}/${target.getDate()}（${weekday}）`
  const relLabel = relativeLabel(target, today)

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 space-y-2">
          <Link href="/" className="text-xs text-text-tertiary hover:text-text-secondary">
            ← 回 dashboard
          </Link>
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-2xl font-semibold text-text-primary">{dateTitle}</h1>
            <span className="rounded-full bg-accent-subtle px-3 py-1 text-xs text-accent">
              {relLabel}
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            事件 {events.length}｜記事 {notes.length}｜Jira {jiraIssues.length}｜離線任務{" "}
            {tasks.length}
          </p>
        </header>

        <div className="space-y-6">
          <CalendarEventSection
            dateKey={dateKey}
            events={events}
            candidates={candidates}
            currentUserId={me.id}
            currentUserRole={me.role}
          />

          <CalendarNoteSection
            dateKey={dateKey}
            notes={notes}
            currentUserId={me.id}
            currentUserRole={me.role}
          />

          {jiraIssues.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-text-secondary">Jira 票</h2>
              <div className="space-y-2">
                {jiraIssues.map((issue) => (
                  <JiraCard key={issue.key} issue={issue} />
                ))}
              </div>
            </section>
          )}

          {tasks.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-text-secondary">
                離線任務（taskpulse 還沒升級到 Jira）
              </h2>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

interface CardTask {
  id: string
  title: string
  completedAt: Date | null
  assignees: { user: { id: string; name: string } }[]
  creator: { id: string; name: string }
  updates: Array<{
    id: string
    summary: string
    status: string | null
    createdAt: Date
  }>
}

function TaskCard({ task }: { task: CardTask }) {
  const latest = task.updates[0]
  const truncated =
    latest?.summary && latest.summary.length > 60
      ? `${latest.summary.slice(0, 60)}…`
      : latest?.summary
  const isCompleted = task.completedAt !== null
  const cardClass = isCompleted
    ? "opacity-60 hover:border-border-default"
    : "hover:border-border-default"

  return (
    <article className={`rounded-md border border-border-subtle bg-surface px-4 py-4 ${cardClass}`}>
      <div className="min-w-0">
        <Link
          href={`/tasks/${task.id}`}
          className="text-base font-medium text-text-primary hover:text-accent"
        >
          {task.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
          <span>指派 {task.assignees.map((a) => a.user.name).join(" / ") || "未指派"}</span>
          <span>建立者 {task.creator.name}</span>
          {isCompleted && <span className="text-success">✓ 已結案</span>}
        </div>

        {latest ? (
          <div className="mt-3 rounded-md bg-canvas px-3 py-2 text-sm text-text-secondary">
            {latest.status && <StatusBadge status={latest.status} />}
            <span className={latest.status ? "ml-2" : ""}>{truncated}</span>
          </div>
        ) : (
          <p className="mt-3 text-xs text-text-tertiary">尚無進度</p>
        )}
      </div>
    </article>
  )
}

function JiraCard({ issue }: { issue: JiraIssue }) {
  const b = bucketDefFor(issue.status)
  return (
    <article className="rounded-md border border-border-subtle bg-surface px-4 py-3 hover:border-border-default">
      <a href={issue.url} target="_blank" rel="noreferrer" className="block min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-medium text-accent">{issue.key}</span>
          <span className={`rounded-full px-2 py-0.5 ${b.cls}`}>{issue.status}</span>
          {issue.priority && <span className="text-text-tertiary">{issue.priority}</span>}
          <span className="text-text-tertiary">指派 {issue.assigneeName}</span>
        </div>
        <p className="mt-1 text-sm text-text-primary">{issue.summary}</p>
      </a>
    </article>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone = status.includes("完成")
    ? "bg-success-subtle text-success"
    : status.includes("卡")
      ? "bg-warning-subtle text-warning"
      : "bg-info-subtle text-info"
  return <span className={`rounded-full ${tone} px-2 py-0.5 text-xs`}>{status}</span>
}
