import Link from "next/link"
import { redirect } from "next/navigation"
import { CopyButton } from "@/components/features/copy-button"
import { getCurrentUser } from "@/lib/current-user"
import { fetchTeamJiraIssues, type JiraIssue } from "@/lib/jira"
import { bucketDefFor, bucketIdFor } from "@/lib/jira-buckets"

const WEEK_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

function buildPlainText(args: {
  weekStart: Date
  inProgress: JiraIssue[]
  blocked: JiraIssue[]
  doneThisWeek: JiraIssue[]
  overdue: JiraIssue[]
}): string {
  const dateStr = `${args.weekStart.getMonth() + 1}/${args.weekStart.getDate()} 起算近 7 天`
  const fmtList = (list: JiraIssue[]) =>
    list.length
      ? list.map((i) => `  - [${i.key}] ${i.summary}（${i.assigneeName}）`).join("\n")
      : "  （無）"

  return [
    `Taskpulse 週報（${dateStr}）— Jira 視角`,
    "",
    `• 進行中：${args.inProgress.length} 張`,
    `• 卡住：${args.blocked.length} 張`,
    `• 本週完成：${args.doneThisWeek.length} 張`,
    `• 已逾期：${args.overdue.length} 張`,
    "",
    "卡住的票：",
    fmtList(args.blocked),
    "",
    "本週完成的票：",
    fmtList(args.doneThisWeek),
    "",
    "已逾期的票：",
    fmtList(args.overdue),
    "",
  ].join("\n")
}

export default async function ReportsPage() {
  const me = await getCurrentUser()
  if (me.role !== "admin") redirect("/")

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(today.getTime() - WEEK_DAYS * MS_PER_DAY)

  const jiraResult = await fetchTeamJiraIssues()
  const issues = jiraResult.kind === "ok" ? jiraResult.issues : []

  // 分類
  const inProgress: JiraIssue[] = []
  const blocked: JiraIssue[] = []
  const doneThisWeek: JiraIssue[] = []
  const overdue: JiraIssue[] = []

  for (const i of issues) {
    const bucket = bucketIdFor(i.status)
    if (bucket === "in_progress" || bucket === "review") inProgress.push(i)
    // 卡住關鍵字（Jira 沒固定 status，靠字串猜）
    if (/block|hold|卡|阻/i.test(i.status)) blocked.push(i)
    if (bucket === "done" && i.updated) {
      const u = new Date(i.updated)
      if (u.getTime() >= weekStart.getTime()) doneThisWeek.push(i)
    }
    if (bucket !== "done" && i.dueDate) {
      const due = parseDateKey(i.dueDate)
      if (due && due.getTime() < today.getTime()) overdue.push(i)
    }
  }

  // overdue 排到最前面、deadline 近的優先
  overdue.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))

  const plainText = buildPlainText({ weekStart, inProgress, blocked, doneThisWeek, overdue })

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">向上回報摘要</h1>
            <p className="mt-1 text-sm text-text-secondary">
              近 7 天｜Jira 視角｜admin 專用
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

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="進行中 / Review" value={inProgress.length} tone="accent" />
          <StatCard label="卡住" value={blocked.length} tone="danger" />
          <StatCard label="本週完成" value={doneThisWeek.length} tone="success" />
          <StatCard label="已逾期" value={overdue.length} tone="warning" />
        </section>

        <Section title="卡住的票" emptyText="目前沒有 status 含「block / 卡 / 阻」的 Jira 票 👌">
          {blocked.map((i) => (
            <JiraRow key={i.key} issue={i} tone="warning" />
          ))}
        </Section>

        <Section title="已逾期的票" emptyText="目前沒有逾期票 👌">
          {overdue.map((i) => (
            <JiraRow key={i.key} issue={i} tone="danger" />
          ))}
        </Section>

        <Section title="本週完成的票" emptyText="本週還沒有完成的票。">
          {doneThisWeek.map((i) => (
            <JiraRow key={i.key} issue={i} tone="success" />
          ))}
        </Section>

        <section className="rounded-md border border-border-subtle bg-surface px-5 py-4">
          <h2 className="mb-2 text-sm font-medium text-text-primary">純文字預覽</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-canvas px-4 py-3 text-xs text-text-secondary">
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

function Section({
  title,
  emptyText,
  children,
}: {
  title: string
  emptyText: string
  children: React.ReactNode
}) {
  const arr = Array.isArray(children) ? children : [children]
  const isEmpty = arr.flat().filter(Boolean).length === 0
  return (
    <section className="rounded-md border border-border-subtle bg-surface px-5 py-4">
      <h2 className="mb-3 text-sm font-medium text-text-primary">{title}</h2>
      {isEmpty ? (
        <p className="text-sm text-text-tertiary">{emptyText}</p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  )
}

function StatCard({
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
    <article className="rounded-md border border-border-subtle bg-surface px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-text-tertiary">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${value > 0 ? toneCls : "text-text-tertiary"}`}>
        {value}
      </div>
    </article>
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
