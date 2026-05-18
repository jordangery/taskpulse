import Link from "next/link"
import { redirect } from "next/navigation"
import { CopyButton } from "@/components/features/copy-button"
import { getCurrentUser } from "@/lib/current-user"
import { fetchTeamJiraIssues, type JiraIssue } from "@/lib/jira"
import { bucketDefFor, bucketIdFor } from "@/lib/jira-buckets"

const WEEK_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

// 一個 project 的 weekly 報告數據
interface ProjectReport {
  projectKey: string // e.g. "BB1"
  total: number // 該 project 全部撈到的票數（含已完成）
  inProgress: JiraIssue[]
  blocked: JiraIssue[]
  doneThisWeek: JiraIssue[]
  overdue: JiraIssue[]
}

// 從 issue.key（"BB1-7954"）抽 project key（"BB1"）
function projectKeyFor(issueKey: string): string {
  const idx = issueKey.indexOf("-")
  return idx > 0 ? issueKey.slice(0, idx) : issueKey
}

function buildPlainText(args: { weekStart: Date; projects: ProjectReport[] }): string {
  const dateStr = `${args.weekStart.getMonth() + 1}/${args.weekStart.getDate()} 起算近 7 天`
  const fmtList = (list: JiraIssue[]) =>
    list.length
      ? list.map((i) => `  - [${i.key}] ${i.summary}（${i.assigneeName}）`).join("\n")
      : "  （無）"

  const lines: string[] = [`Taskpulse 週報（${dateStr}）— Jira 視角，分專案`, ""]

  for (const p of args.projects) {
    lines.push(
      `=== ${p.projectKey}（${p.total} 張）===`,
      `• 進行中／Review：${p.inProgress.length}　卡住：${p.blocked.length}　本週完成：${p.doneThisWeek.length}　已逾期：${p.overdue.length}`,
      "",
      "卡住：",
      fmtList(p.blocked),
      "",
      "本週完成：",
      fmtList(p.doneThisWeek),
      "",
      "已逾期：",
      fmtList(p.overdue),
      "",
    )
  }
  return lines.join("\n")
}

function buildProjectReport(
  projectKey: string,
  issues: JiraIssue[],
  args: {
    today: Date
    weekStart: Date
  },
): ProjectReport {
  const r: ProjectReport = {
    projectKey,
    total: issues.length,
    inProgress: [],
    blocked: [],
    doneThisWeek: [],
    overdue: [],
  }
  for (const i of issues) {
    const bucket = bucketIdFor(i.status)
    if (bucket === "in_progress" || bucket === "review") r.inProgress.push(i)
    if (/block|hold|卡|阻/i.test(i.status)) r.blocked.push(i)
    if (bucket === "done" && i.updated) {
      const u = new Date(i.updated)
      if (u.getTime() >= args.weekStart.getTime()) r.doneThisWeek.push(i)
    }
    if (bucket !== "done" && i.dueDate) {
      const due = parseDateKey(i.dueDate)
      if (due && due.getTime() < args.today.getTime()) r.overdue.push(i)
    }
  }
  r.overdue.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
  return r
}

export default async function ReportsPage() {
  const me = await getCurrentUser()
  if (me.role !== "admin") redirect("/")

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(today.getTime() - WEEK_DAYS * MS_PER_DAY)

  const jiraResult = await fetchTeamJiraIssues()
  const issues = jiraResult.kind === "ok" ? jiraResult.issues : []

  // 依 project key 分組
  const byProject = new Map<string, JiraIssue[]>()
  for (const i of issues) {
    const pk = projectKeyFor(i.key)
    const arr = byProject.get(pk)
    if (arr) arr.push(i)
    else byProject.set(pk, [i])
  }

  // 依 project 票數由多到少排
  const allProjects: ProjectReport[] = Array.from(byProject.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([pk, list]) => buildProjectReport(pk, list, { today, weekStart }))

  // 沒有「卡住 / 已逾期 / 本週完成」任何一筆的 project 不出現在報告
  // （想看完整列表去 Jira 自己看；報告只列「需要回報的事」）
  const projects = allProjects.filter(
    (p) => p.blocked.length + p.overdue.length + p.doneThisWeek.length > 0,
  )
  const skippedProjects = allProjects.length - projects.length

  // 全體總覽（多 project 時才有意義；數字用 projects 過濾後的 = 跟下面卡片一致）
  const overall = {
    inProgress: projects.reduce((s, p) => s + p.inProgress.length, 0),
    blocked: projects.reduce((s, p) => s + p.blocked.length, 0),
    doneThisWeek: projects.reduce((s, p) => s + p.doneThisWeek.length, 0),
    overdue: projects.reduce((s, p) => s + p.overdue.length, 0),
  }
  const showOverall = projects.length > 1

  const plainText = buildPlainText({ weekStart, projects })

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">向上回報摘要</h1>
            <p className="mt-1 text-sm text-text-secondary">
              近 7 天｜Jira 視角｜admin 專用｜{projects.length} 個專案要回報
              {skippedProjects > 0 && (
                <span className="ml-1 text-text-tertiary">（{skippedProjects} 個沒事略過）</span>
              )}
              {jiraResult.kind !== "ok" && (
                <span className="ml-2 text-warning">
                  {jiraResult.kind === "not_configured"
                    ? "（Jira 未設定）"
                    : jiraResult.kind === "not_connected"
                      ? "（admin 尚未連結 Atlassian）"
                      : "（Jira 連線錯誤）"}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/api/export"
              className="rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-subtle hover:text-text-primary"
            >
              下載 JSON 備份
            </Link>
            <CopyButton text={plainText} />
          </div>
        </header>

        {showOverall && (
          <section className="rounded-md border border-border-subtle bg-surface px-5 py-4">
            <h2 className="mb-3 text-sm font-medium text-text-primary">全體總覽</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="進行中 / Review" value={overall.inProgress} tone="accent" />
              <StatTile label="卡住" value={overall.blocked} tone="danger" />
              <StatTile label="本週完成" value={overall.doneThisWeek} tone="success" />
              <StatTile label="已逾期" value={overall.overdue} tone="warning" />
            </div>
          </section>
        )}

        {projects.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-default bg-surface px-6 py-12 text-center text-sm text-text-tertiary">
            目前撈不到任何 Jira 票，無法產生分專案報告。
          </p>
        ) : (
          projects.map((p) => <ProjectCard key={p.projectKey} report={p} />)
        )}

        <section className="rounded-md border border-border-subtle bg-surface px-5 py-4">
          <h2 className="mb-2 text-sm font-medium text-text-primary">純文字預覽（含所有專案）</h2>
          <pre className="scrollbar-subtle max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-canvas px-4 py-3 text-xs text-text-secondary">
            {plainText}
          </pre>
        </section>
      </div>
    </div>
  )
}

function parseDateKey(key: string): Date | null {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return new Date(y, mo - 1, d, 0, 0, 0, 0)
}

function ProjectCard({ report: p }: { report: ProjectReport }) {
  return (
    <article className="rounded-md border border-border-subtle bg-surface px-5 py-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-medium text-text-primary">
          <span className="font-mono text-accent">{p.projectKey}</span>
          <span className="ml-2 text-xs text-text-tertiary">{p.total} 張</span>
        </h2>
      </header>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="進行中 / Review" value={p.inProgress.length} tone="accent" />
        <StatTile label="卡住" value={p.blocked.length} tone="danger" />
        <StatTile label="本週完成" value={p.doneThisWeek.length} tone="success" />
        <StatTile label="已逾期" value={p.overdue.length} tone="warning" />
      </div>

      {/* 三段 issue 列表，空的不渲染整段（減少視覺雜訊）
       * 卡住 / 已逾期 = 需要關注，用詳細 row
       * 本週完成 = 已過去的成果報告，用 compact 單行 row + scroll，避免列表把整頁拉長 */}
      {p.blocked.length > 0 && <SubSection title="卡住的票" issues={p.blocked} tone="warning" />}
      {p.overdue.length > 0 && <SubSection title="已逾期的票" issues={p.overdue} tone="danger" />}
      {p.doneThisWeek.length > 0 && (
        <SubSection title="本週完成的票" issues={p.doneThisWeek} tone="success" compact />
      )}
    </article>
  )
}

function SubSection({
  title,
  issues,
  tone,
  compact = false,
}: {
  title: string
  issues: JiraIssue[]
  tone: "warning" | "success" | "danger"
  // compact = 單行 row + max-h 捲動（給「本週完成」這類量大但每筆都已 done 不必細看的）
  compact?: boolean
}) {
  return (
    <section className="mb-3 last:mb-0">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
        {title}（{issues.length}）
      </h3>
      {compact ? (
        <ul className="scrollbar-subtle max-h-48 space-y-1 overflow-y-auto rounded-md border border-border-subtle bg-canvas px-2 py-1">
          {issues.map((i) => (
            <CompactJiraRow key={i.key} issue={i} />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {issues.map((i) => (
            <JiraRow key={i.key} issue={i} tone={tone} />
          ))}
        </ul>
      )}
    </section>
  )
}

function CompactJiraRow({ issue }: { issue: JiraIssue }) {
  return (
    <li className="flex items-center gap-2 px-1 py-1 text-xs hover:bg-subtle">
      <a
        href={issue.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <span className="flex-shrink-0 font-mono font-medium text-success">{issue.key}</span>
        <span className="min-w-0 flex-1 truncate text-text-primary">{issue.summary}</span>
        <span className="flex-shrink-0 text-[11px] text-text-tertiary">{issue.assigneeName}</span>
      </a>
    </li>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "accent" | "danger" | "success" | "warning"
}) {
  const toneCls = {
    accent: "text-accent",
    danger: "text-danger",
    success: "text-success",
    warning: "text-warning",
  }[tone]
  return (
    <div className="rounded-md bg-canvas px-3 py-2">
      <p className="text-[10px] text-text-tertiary">{label}</p>
      <p className={`text-2xl font-semibold ${value > 0 ? toneCls : "text-text-tertiary"}`}>
        {value}
      </p>
    </div>
  )
}

function JiraRow({ issue, tone }: { issue: JiraIssue; tone: "warning" | "success" | "danger" }) {
  const accentCls = {
    warning: "border-l-warning bg-warning-subtle",
    success: "border-l-success bg-success-subtle",
    danger: "border-l-danger bg-danger-subtle",
  }[tone]
  const b = bucketDefFor(issue.status)
  return (
    <li className={`rounded-r-md border-l-[3px] ${accentCls} px-4 py-2`}>
      <a
        href={issue.url}
        target="_blank"
        rel="noreferrer"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <span className="font-mono font-medium text-accent hover:text-accent-hover">
          {issue.key}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${b.cls}`}>{issue.status}</span>
        <span className="text-xs text-text-tertiary">{issue.assigneeName}</span>
        {issue.dueDate && <span className="text-xs text-text-tertiary">截止 {issue.dueDate}</span>}
      </a>
      <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{issue.summary}</p>
    </li>
  )
}
