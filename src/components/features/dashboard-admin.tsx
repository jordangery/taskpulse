import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { retryJiraSyncAll } from "@/lib/actions/tasks"
import { fetchCalendarEvents } from "@/lib/calendar"
import { requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { ChartPeopleTasks } from "./chart-people-tasks"
import { ChartUpdateFrequency } from "./chart-update-frequency"
import { DashboardCalendar } from "./dashboard-calendar"
import { DashboardJiraWidget } from "./dashboard-jira-widget"

const WEEK_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function formatDayLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

async function fetchPeopleTasks() {
  const users = await prisma.user.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      _count: { select: { assignedTasks: { where: { archivedAt: null } } } },
    },
    orderBy: { name: "asc" },
  })
  return users.map((u) => ({ name: u.name, count: u._count.assignedTasks }))
}

async function fetchUpdateFrequency() {
  const today = startOfDay(new Date())
  const start = new Date(today.getTime() - (WEEK_DAYS - 1) * MS_PER_DAY)
  const updates = await prisma.progressUpdate.findMany({
    where: { createdAt: { gte: start } },
    select: { createdAt: true },
  })

  const buckets = new Map<string, number>()
  for (let i = 0; i < WEEK_DAYS; i++) {
    const d = new Date(start.getTime() + i * MS_PER_DAY)
    buckets.set(d.toISOString().slice(0, 10), 0)
  }
  for (const u of updates) {
    const key = startOfDay(u.createdAt).toISOString().slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({
    date,
    label: formatDayLabel(new Date(date)),
    count,
  }))
}

async function fetchRecentUpdates() {
  return prisma.progressUpdate.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      summary: true,
      createdAt: true,
      task: { select: { id: true, title: true } },
      author: { select: { id: true, name: true } },
      feedbacks: { select: { id: true }, take: 1 },
    },
  })
}

export async function DashboardAdmin() {
  const me = await requireAdmin()
  const [peopleTasks, freq, unfeedbacked, recent, activeTaskCount, calendar, pendingJiraSync] =
    await Promise.all([
      fetchPeopleTasks(),
      fetchUpdateFrequency(),
      prisma.progressUpdate.count({ where: { feedbacks: { none: {} } } }),
      fetchRecentUpdates(),
      prisma.task.count({ where: { archivedAt: null } }),
      fetchCalendarEvents(me.id, true),
      prisma.task.count({ where: { archivedAt: null, jiraIssueKey: null } }),
    ])

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            全隊 {activeTaskCount} 筆現役任務｜
            <span className={unfeedbacked > 0 ? "text-warning" : "text-text-tertiary"}>
              {unfeedbacked} 筆進度尚未回饋
            </span>
          </p>
        </header>

        {pendingJiraSync > 0 && (
          <form
            action={async () => {
              "use server"
              await retryJiraSyncAll()
            }}
            className="flex items-center justify-between rounded-md border border-warning bg-warning-subtle px-4 py-3"
          >
            <div className="text-sm text-warning">
              <span className="font-medium">⚠ {pendingJiraSync} 個任務還沒同步到 Jira</span>
              <span className="ml-2 text-xs">（Jira 離線時建立的、或之前同步失敗的）</span>
            </div>
            <button
              type="submit"
              className="rounded-md bg-warning px-3 py-1 text-xs font-medium text-text-inverse hover:opacity-90"
            >
              重試全部
            </button>
          </form>
        )}

        <DashboardCalendar events={calendar.events} todayKey={calendar.todayKey} />

        {/* 3-col：兩張 chart + 未獲回饋大數字 */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card title="每人活躍任務數" hint="未封存任務按 assignee 分組">
            <ChartPeopleTasks data={peopleTasks} />
          </Card>

          <Card title="本週進度更新頻率" hint="近 7 天每天的 ProgressUpdate 數量">
            <ChartUpdateFrequency data={freq} />
          </Card>

          <Card title="未獲回饋進度" hint="尚無 1:1 回饋的 ProgressUpdate 數">
            <div className="flex h-24 items-center justify-center">
              <span
                className={`text-5xl font-semibold ${
                  unfeedbacked > 0 ? "text-warning" : "text-text-tertiary"
                }`}
              >
                {unfeedbacked}
              </span>
            </div>
          </Card>
        </section>

        {/* 12-col：左 7 最近動態、右 5 Jira widget */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Card title="最近 5 筆進度動態" hint="跨任務 timeline" className="lg:col-span-7">
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-tertiary">還沒有進度紀錄</p>
            ) : (
              <ul className="space-y-2">
                {recent.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-start gap-3 rounded-md border border-border-subtle bg-canvas px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Link
                          href={`/tasks/${u.task.id}`}
                          className="font-medium text-accent hover:text-accent-hover"
                        >
                          {u.task.title}
                        </Link>
                        <span className="text-text-tertiary">— {u.author.name}</span>
                        {u.feedbacks.length === 0 && (
                          <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-warning">
                            尚未回饋
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{u.summary}</p>
                    </div>
                    <time className="flex-shrink-0 text-xs text-text-tertiary">
                      {formatDistanceToNow(u.createdAt, { locale: zhTW, addSuffix: true })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="lg:col-span-5">
            <DashboardJiraWidget scope="team" />
          </div>
        </section>
      </div>
    </div>
  )
}

function Card({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <article
      className={`rounded-md border border-border-subtle bg-surface px-5 py-4 ${className ?? ""}`}
    >
      <header className="mb-3">
        <h2 className="text-sm font-medium text-text-primary">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-text-tertiary">{hint}</p>}
      </header>
      {children}
    </article>
  )
}
