// taskpulse - src/components/features/dashboard-jira-widget.tsx
//
// Phase D - Dashboard Jira widget
// Server component。member 看 scope="mine"、admin 看 scope="team"
// 四種狀態：not_configured / not_connected / error / ok
// Token-only styling（不可有 hex / bg-white / bg-gray-*）

import { requireUser } from "@/lib/current-user"
import { fetchMyJiraIssues, fetchTeamJiraIssues } from "@/lib/jira"
import { JiraIssueList } from "./dashboard-jira-issue-list"

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

  return <JiraIssueList issues={result.issues} showAssignee={scope === "team"} />
}
