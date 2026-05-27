"use client"

// taskpulse - src/components/features/project-versions-bar.tsx
//
// Dashboard 頂部一條 bar：列各專案的「最新已 release」+「目前 unreleased」版號
// + 該專案目前在追的票數（從 team Jira issues 撈出 project key prefix 分組）
// 點任一張 chip 展開／收合該專案的票清單（依 bucket 分群）

import { useMemo, useState } from "react"
import type { JiraIssue, ProjectVersionsResult } from "@/lib/jira"
import { type BucketId, bucketDefFor, DISPLAY_ORDER } from "@/lib/jira-buckets"

interface Props {
  result: ProjectVersionsResult
  issues: JiraIssue[]
}

export function ProjectVersionsBar({ result, issues }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  // issue key e.g. "BB-123" → project key "BB"
  const issuesByProject = useMemo(() => {
    const map = new Map<string, JiraIssue[]>()
    for (const issue of issues) {
      const dash = issue.key.indexOf("-")
      if (dash <= 0) continue
      const projectKey = issue.key.slice(0, dash)
      const list = map.get(projectKey) ?? []
      list.push(issue)
      map.set(projectKey, list)
    }
    return map
  }, [issues])

  if (result.kind !== "ok" || result.projects.length === 0) return null

  const selectedIssues = selected ? (issuesByProject.get(selected) ?? []) : []
  const selectedProject = selected ? result.projects.find((p) => p.projectKey === selected) : null

  return (
    <article className="rounded-md border border-border-subtle bg-surface px-4 py-3">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-text-primary">專案版號</h2>
        <p className="text-xs text-text-tertiary">released / 開發中 · 點 chip 看該專案票</p>
      </header>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {result.projects.map((p) => {
          const count = issuesByProject.get(p.projectKey)?.length ?? 0
          const isActive = selected === p.projectKey
          return (
            <button
              key={p.projectKey}
              type="button"
              onClick={() => setSelected(isActive ? null : p.projectKey)}
              aria-expanded={isActive}
              className={`rounded-md border px-3 py-2 text-left transition ${
                isActive
                  ? "border-accent bg-accent-subtle"
                  : "border-border-subtle bg-canvas hover:border-border-default hover:bg-subtle"
              }`}
            >
              <p className="flex items-baseline justify-between gap-1.5">
                <span className="flex items-baseline gap-1.5 truncate">
                  <span className="font-mono text-xs text-accent">{p.projectKey}</span>
                  <span className="truncate text-xs text-text-tertiary">{p.projectName}</span>
                </span>
                {count > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-subtle px-1.5 text-[10px] font-medium text-text-secondary">
                    {count}
                  </span>
                )}
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
            </button>
          )
        })}
      </div>

      {/* 展開區：選到的專案的所有票，依 bucket 分群 */}
      {selected && selectedProject && (
        <ProjectIssuesPanel
          projectKey={selected}
          projectName={selectedProject.projectName}
          issues={selectedIssues}
          onClose={() => setSelected(null)}
        />
      )}
    </article>
  )
}

function ProjectIssuesPanel({
  projectKey,
  projectName,
  issues,
  onClose,
}: {
  projectKey: string
  projectName: string
  issues: JiraIssue[]
  onClose: () => void
}) {
  // 依 bucket 分群：open / in_progress / review / done / other（DISPLAY_ORDER 順序）
  const byBucket = useMemo(() => {
    const map = new Map<BucketId, JiraIssue[]>()
    for (const issue of issues) {
      const def = bucketDefFor(issue.status)
      const list = map.get(def.id) ?? []
      list.push(issue)
      map.set(def.id, list)
    }
    // 同 bucket 內：dueDate asc (null last) → updated desc
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return (b.updated ?? "").localeCompare(a.updated ?? "")
      })
    }
    return map
  }, [issues])

  if (issues.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-border-default bg-canvas px-3 py-4 text-center text-xs text-text-tertiary">
        <span className="font-mono text-accent">{projectKey}</span> 目前沒有在追的票
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-text-tertiary underline hover:text-text-secondary"
        >
          關閉
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-md border border-border-subtle bg-canvas p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs text-text-secondary">
          <span className="font-mono font-medium text-accent">{projectKey}</span>
          <span className="ml-1.5 text-text-tertiary">{projectName}</span>
          <span className="ml-2 text-text-tertiary">· {issues.length} 張</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-text-tertiary underline hover:text-text-secondary"
        >
          關閉
        </button>
      </div>
      <div className="space-y-3">
        {DISPLAY_ORDER.filter((id) => (byBucket.get(id)?.length ?? 0) > 0).map((id) => {
          const list = byBucket.get(id) ?? []
          const def = bucketDefFor(list[0]?.status ?? "")
          return (
            <section key={id}>
              <h3 className="mb-1.5 flex items-baseline gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${def.cls}`}>
                  {def.label}
                </span>
                <span className="text-text-tertiary">{list.length} 張</span>
              </h3>
              <ul className="divide-y divide-border-subtle overflow-hidden rounded-md border border-border-subtle">
                {list.map((issue) => (
                  <li key={issue.key} className="hover:bg-subtle">
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-3 py-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-baseline gap-2 truncate">
                          <span className="flex-shrink-0 font-mono text-xs font-medium text-accent">
                            {issue.key}
                          </span>
                          <span className="truncate text-xs text-text-primary">
                            {issue.summary}
                          </span>
                        </span>
                        <span className="flex-shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
                          {issue.status}
                        </span>
                      </div>
                      {(issue.assigneeName ||
                        issue.dueDate ||
                        issue.fixVersions.length > 0 ||
                        issue.priority) && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-tertiary">
                          {issue.assigneeName && <span>👤 {issue.assigneeName}</span>}
                          {issue.dueDate && <DueDateChip due={issue.dueDate} />}
                          {issue.fixVersions.length > 0 && (
                            <span className="rounded bg-subtle px-1.5 py-0.5 text-text-secondary">
                              v{issue.fixVersions.join(" / ")}
                            </span>
                          )}
                          {issue.priority && <span>· {issue.priority}</span>}
                        </div>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function DueDateChip({ due }: { due: string }) {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  if (due < todayKey) {
    return <span className="font-medium text-danger">⏰ {due}（逾期）</span>
  }
  if (due === todayKey) {
    return <span className="font-medium text-warning">⏰ {due}（今天）</span>
  }
  return <span>⏰ {due}</span>
}
