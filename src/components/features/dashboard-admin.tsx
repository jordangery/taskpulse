import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { retryJiraSyncAll } from "@/lib/actions/tasks"
import { fetchCalendarEvents } from "@/lib/calendar"
import { requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { fetchTeamJiraIssues, type JiraIssue, jiraWriteEnabled } from "@/lib/jira"
import { bucketIdFor } from "@/lib/jira-buckets"
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

// 把 team Jira issues 拆成 3 個 top stats：
// 1. 每人未完成（依 assignee 分組，排除 done bucket）
// 2. 近 7 天 Jira 活動（依 updated 日期分桶，回最近 7 天）
// 3. 本週完成數（done bucket 且 updated 在最近 7 天內）
function computeJiraTopStats(issues: JiraIssue[]) {
  const today = startOfDay(new Date())
  const weekAgoMs = today.getTime() - (WEEK_DAYS - 1) * MS_PER_DAY

  const peopleMap = new Map<string, number>()
  const dayBuckets = new Map<string, number>()
  let completedThisWeek = 0

  for (let i = 0; i < WEEK_DAYS; i++) {
    const d = new Date(weekAgoMs + i * MS_PER_DAY)
    dayBuckets.set(d.toISOString().slice(0, 10), 0)
  }

  for (const issue of issues) {
    const bucket = bucketIdFor(issue.status)
    if (bucket !== "done") {
      peopleMap.set(issue.assigneeName, (peopleMap.get(issue.assigneeName) ?? 0) + 1)
    }
    if (issue.updated) {
      const updatedDate = startOfDay(new Date(issue.updated))
      const key = updatedDate.toISOString().slice(0, 10)
      if (dayBuckets.has(key)) {
        dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1)
      }
      if (bucket === "done" && updatedDate.getTime() >= weekAgoMs) {
        completedThisWeek++
      }
    }
  }

  return {
    peopleTasks: Array.from(peopleMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    freq: Array.from(dayBuckets.entries()).map(([date, count]) => ({
      date,
      label: formatDayLabel(new Date(date)),
      count,
    })),
    completedThisWeek,
  }
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
  const [recent, activeTaskCount, calendar, pendingJiraSync, teamJira] = await Promise.all([
    fetchRecentUpdates(),
    prisma.task.count({ where: { archivedAt: null } }),
    fetchCalendarEvents(me.id, true),
    prisma.task.count({ where: { archivedAt: null, jiraIssueKey: null } }),
    fetchTeamJiraIssues(),
  ])
  // top 3 卡：純看 Jira 視角；team Jira 沒連上時用空 array 跑（chart 自然顯示 0）
  const jiraIssues = teamJira.kind === "ok" ? teamJira.issues : []
  const { peopleTasks, freq, completedThisWeek } = computeJiraTopStats(jiraIssues)

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            全隊 {activeTaskCount} 筆 taskpulse 任務｜Jira {jiraIssues.length} 張在追蹤中
          </p>
        </header>

        {jiraWriteEnabled() && pendingJiraSync > 0 && (
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
          <Card title="每人未完成 Jira 票" hint="非已完成 bucket，依 assignee 分組">
            <ChartPeopleTasks data={peopleTasks} />
          </Card>

          <Card title="近 7 天 Jira 活動" hint="每天有多少張票被更新（任何狀態變動）">
            <ChartUpdateFrequency data={freq} />
          </Card>

          <Card title="本週已完成 Jira 數" hint="近 7 天進入「已完成」bucket 的票數">
            <div className="flex h-24 items-center justify-center">
              <span
                className={`text-5xl font-semibold ${
                  completedThisWeek > 0 ? "text-success" : "text-text-tertiary"
                }`}
              >
                {completedThisWeek}
              </span>
            </div>
          </Card>
        </section>

        {/* Jira 看板：先「我的」再「團隊」（admin 自己派單前先看自己手上的單） */}
        <DashboardJiraWidget scope="mine" />
        <DashboardJiraWidget scope="team" result={teamJira} />

        <Card title="最近 5 筆進度動態" hint="跨任務 timeline">
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
