// taskpulse - src/components/features/project-versions-bar.tsx
//
// Dashboard 頂部一條 bar：列各專案的「最新已 release」+「目前 unreleased」版號
// 純 server component（資料從 server 傳進來）— 不需要 client state

import type { ProjectVersionsResult } from "@/lib/jira"

interface Props {
  result: ProjectVersionsResult
}

export function ProjectVersionsBar({ result }: Props) {
  if (result.kind !== "ok" || result.projects.length === 0) return null

  return (
    <article className="rounded-md border border-border-subtle bg-surface px-4 py-3">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-text-primary">專案版號</h2>
        <p className="text-xs text-text-tertiary">released / 開發中</p>
      </header>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {result.projects.map((p) => (
          <div
            key={p.projectKey}
            className="rounded-md border border-border-subtle bg-canvas px-3 py-2"
          >
            <p className="flex items-baseline gap-1.5">
              <span className="font-mono text-xs text-accent">{p.projectKey}</span>
              <span className="truncate text-xs text-text-tertiary">{p.projectName}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              {p.latestReleased ? (
                <span
                  className="rounded-full bg-success-subtle px-2 py-0.5 text-success"
                  title={
                    p.latestReleased.releaseDate
                      ? `Released ${p.latestReleased.releaseDate}`
                      : "Released"
                  }
                >
                  ✓ {p.latestReleased.name}
                </span>
              ) : (
                <span className="text-text-tertiary">尚無 released</span>
              )}
              {p.nextUnreleased && (
                <span
                  className="rounded-full bg-info-subtle px-2 py-0.5 text-info"
                  title={
                    p.nextUnreleased.startDate
                      ? `Started ${p.nextUnreleased.startDate}`
                      : "In progress"
                  }
                >
                  ▶ {p.nextUnreleased.name}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}
