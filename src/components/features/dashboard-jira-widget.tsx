// taskpulse - src/components/features/dashboard-jira-widget.tsx
//
// Phase D - Dashboard Jira widget
// Server component。member 看 scope="mine"、admin 看 scope="team"
// 四種狀態：not_configured / not_connected / error / ok
// Token-only styling（不可有 hex / bg-white / bg-gray-*）

import { requireUser } from "@/lib/current-user"
import { fetchMyJiraIssues, fetchTeamJiraIssues, type JiraIssue } from "@/lib/jira"

interface Props {
  scope: "mine" | "team"
}

const ATLASSIAN_CONSOLE_URL = "https://developer.atlassian.com/console/myapps/"

export async function DashboardJiraWidget({ scope }: Props) {
  const result =
    scope === "team"
      ? await fetchTeamJiraIssues()
      : await fetchMyJiraIssues((await requireUser()).id)

  return (
    <article className="rounded-md border border-border-subtle bg-surface px-5 py-4">
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Jira</h2>
          <p className="mt-0.5 text-xs text-text-tertiary">
            {scope === "team"
              ? "團隊所有成員已連結 Atlassian 後的 Jira 票"
              : "你在 Atlassian 被指派的 Jira 票"}
          </p>
        </div>
        {result.kind === "ok" && (
          <p className="text-xs text-text-tertiary">{result.issues.length} 張</p>
        )}
      </header>

      <Body scope={scope} result={result} />
    </article>
  )
}

function Body({
  scope,
  result,
}: {
  scope: "mine" | "team"
  result: Awaited<ReturnType<typeof fetchMyJiraIssues>>
}) {
  if (result.kind === "not_configured") {
    return (
      <div className="rounded-md border border-dashed border-border-default bg-canvas px-4 py-6 text-sm text-text-secondary">
        <p>Jira 整合尚未設定。</p>
        <p className="mt-1 text-xs text-text-tertiary">
          請於 <code className="rounded bg-subtle px-1">.env</code> 設定{" "}
          <code className="rounded bg-subtle px-1">ATLASSIAN_CLIENT_ID</code> 與{" "}
          <code className="rounded bg-subtle px-1">ATLASSIAN_CLIENT_SECRET</code>，並到{" "}
          <a
            href={ATLASSIAN_CONSOLE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:text-accent-hover"
          >
            Atlassian Developer Console
          </a>{" "}
          建立 OAuth 2.0 (3LO) App。
        </p>
      </div>
    )
  }

  if (result.kind === "not_connected") {
    return (
      <div className="rounded-md border border-dashed border-border-default bg-canvas px-4 py-6 text-sm text-text-secondary">
        <p>{scope === "team" ? "目前還沒有任何組員連結 Atlassian。" : "你還沒連結 Atlassian。"}</p>
        <form action="/api/jira/connect" method="post" className="mt-3">
          <button
            type="submit"
            className="rounded-md border border-border-default bg-canvas px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-subtle"
          >
            Connect Atlassian
          </button>
        </form>
      </div>
    )
  }

  if (result.kind === "error") {
    return (
      <div className="rounded-md bg-danger-subtle px-4 py-3 text-sm text-danger">
        <p className="font-medium">Jira 連線錯誤</p>
        <p className="mt-1 line-clamp-3 text-xs">{result.message}</p>
        <form action="/api/jira/connect" method="post" className="mt-2">
          <button type="submit" className="text-xs text-accent hover:text-accent-hover">
            重新連結 Atlassian
          </button>
        </form>
      </div>
    )
  }

  if (result.issues.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-tertiary">
        目前沒有指派給{scope === "team" ? "團隊" : "你"}的 Jira 票。
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {result.issues.map((issue) => (
        <IssueRow key={issue.key} issue={issue} showAssignee={scope === "team"} />
      ))}
    </ul>
  )
}

function IssueRow({ issue, showAssignee }: { issue: JiraIssue; showAssignee: boolean }) {
  return (
    <li className="rounded-md border border-border-subtle bg-canvas px-3 py-2">
      <div className="flex items-start gap-2">
        <a href={issue.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono font-medium text-accent hover:text-accent-hover">
              {issue.key}
            </span>
            <StatusBadge status={issue.status} />
            {issue.priority && <span className="text-text-tertiary">{issue.priority}</span>}
            {showAssignee && <span className="text-text-tertiary">— {issue.assigneeName}</span>}
            {issue.dueDate && <span className="text-text-tertiary">截止 {issue.dueDate}</span>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-text-primary">{issue.summary}</p>
        </a>
      </div>
    </li>
  )
}

function StatusBadge({ status }: { status: string }) {
  // Jira status 變化多端，簡單用關鍵字分組顏色（token-only）
  const lower = status.toLowerCase()
  let cls = "bg-subtle text-text-secondary"
  if (lower.includes("done") || lower.includes("closed") || lower.includes("resolved")) {
    cls = "bg-success-subtle text-success"
  } else if (lower.includes("progress") || lower.includes("review")) {
    cls = "bg-accent-subtle text-accent"
  } else if (lower.includes("block")) {
    cls = "bg-danger-subtle text-danger"
  } else if (lower.includes("todo") || lower.includes("open") || lower.includes("backlog")) {
    cls = "bg-warning-subtle text-warning"
  }
  return <span className={`rounded-full px-2 py-0.5 ${cls}`}>{status}</span>
}
