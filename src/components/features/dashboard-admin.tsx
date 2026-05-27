import { retryJiraSyncAll } from "@/lib/actions/tasks"
import { fetchCalendarEvents } from "@/lib/calendar"
import { requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import {
  fetchProjectVersionSummary,
  fetchTeamJiraIssues,
  type JiraIssue,
  jiraWriteEnabled,
} from "@/lib/jira"
import { bucketIdFor } from "@/lib/jira-buckets"
import { DashboardCalendar } from "./dashboard-calendar"
import { DashboardJiraWidget } from "./dashboard-jira-widget"
import { PeopleOpenJira } from "./people-open-jira"
import { ProjectVersionsBar } from "./project-versions-bar"

// 把 team Jira issues 依 assignee 分組（排除 done bucket），用來算「每人未完成 Jira 票」
function computePeopleOpenJira(issues: JiraIssue[]) {
  const map = new Map<string, JiraIssue[]>()
  for (const issue of issues) {
    if (bucketIdFor(issue.status) === "done") continue
    const list = map.get(issue.assigneeName) ?? []
    list.push(issue)
    map.set(issue.assigneeName, list)
  }

  // 每人內部排序：dueDate 近的優先（null 排最後）、再用 updated desc
  const sortIssues = (a: JiraIssue, b: JiraIssue) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    const aU = a.updated ?? ""
    const bU = b.updated ?? ""
    return bU.localeCompare(aU)
  }

  return Array.from(map.entries())
    .map(([name, list]) => ({
      name,
      count: list.length,
      issues: list.slice().sort(sortIssues),
    }))
    .sort((a, b) => b.count - a.count)
}

// 決定「專案版號」要顯示哪些 project key（給 fetchProjectVersionSummary）
// 優先順序：
//   1. env JIRA_VERSION_PROJECT_KEYS 有設且非 "*" → 那個 allowlist
//   2. env 設 "*" → 回 undefined（fetchProjectVersionSummary 會自己撈所有）
//   3. env 沒設 → 從 team Jira issue keys 反推（保證每個有票的 project 都會被查、不漏）
function resolveVersionProjectKeys(teamIssues: { key: string }[]): string[] | undefined {
  const envValue = process.env.JIRA_VERSION_PROJECT_KEYS?.trim()
  if (envValue === "*") return undefined
  if (envValue) {
    return envValue
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
  }
  const keys = new Set<string>()
  for (const issue of teamIssues) {
    const dash = issue.key.indexOf("-")
    if (dash > 0) keys.add(issue.key.slice(0, dash))
  }
  // 沒票（teamJira 沒連上等）→ 回 undefined 讓 fetcher 撈所有
  return keys.size > 0 ? Array.from(keys) : undefined
}

export async function DashboardAdmin() {
  const me = await requireAdmin()
  // Phase 1: 不依賴 team Jira 的 query 平行跑（含 fetchTeamJiraIssues 本身）
  const [activeTaskCount, calendar, pendingJiraSync, teamJira] = await Promise.all([
    prisma.task.count({ where: { archivedAt: null } }),
    fetchCalendarEvents(me.id, true),
    prisma.task.count({ where: { archivedAt: null, jiraIssueKey: null } }),
    fetchTeamJiraIssues(),
  ])
  // top 3 卡：純看 Jira 視角；team Jira 沒連上時用空 array 跑
  const jiraIssues = teamJira.kind === "ok" ? teamJira.issues : []
  const peopleOpenJira = computePeopleOpenJira(jiraIssues)

  // Phase 2: 用 team Jira 反推要查哪些 project 的版本（保證涵蓋）
  const versionTargetKeys = resolveVersionProjectKeys(jiraIssues)
  const projectVersions = await fetchProjectVersionSummary(versionTargetKeys)

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            全隊 {activeTaskCount} 筆 taskpulse 任務｜Jira {jiraIssues.length} 張在追蹤中
          </p>
        </header>

        <ProjectVersionsBar result={projectVersions} issues={jiraIssues} />

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

        {/* 順序：團隊 Jira → (我的 Jira 左 + Calendar 右) → 每人未完成 */}
        <DashboardJiraWidget scope="team" result={teamJira} />

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardJiraWidget scope="mine" />
          <DashboardCalendar events={calendar.events} todayKey={calendar.todayKey} />
        </section>

        <Card title="每人未完成 Jira 票" hint="點任一人展開／收合該人的票清單">
          <PeopleOpenJira data={peopleOpenJira} />
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
