"use client"

// 拆出來的 client 子元件 —— Jira issue 列表 + status 篩選 chips
// 父層（dashboard-jira-widget.tsx）仍是 server component，負責 fetch + 4 種 state 處理
// 只有 "ok" 分支會把 issues 傳進來這裡

import { useMemo, useState } from "react"
import type { JiraIssue } from "@/lib/jira"

interface Props {
  issues: JiraIssue[]
  showAssignee: boolean
}

// Jira status 字串多端：用關鍵字歸類成 4 個 bucket，給對應 token 顏色
// 找不到 match 落入 "其他"，用 neutral 灰
type Bucket = {
  match: RegExp
  cls: string // 未選中
  activeCls: string // 選中
}
const BUCKETS: Bucket[] = [
  {
    match: /todo|open|backlog|to do|new/,
    cls: "bg-warning-subtle text-warning",
    activeCls: "bg-warning text-text-inverse",
  },
  {
    match: /progress|review|doing/,
    cls: "bg-accent-subtle text-accent",
    activeCls: "bg-accent text-text-inverse",
  },
  {
    match: /block|hold/,
    cls: "bg-danger-subtle text-danger",
    activeCls: "bg-danger text-text-inverse",
  },
  {
    match: /done|closed|resolved|complete/,
    cls: "bg-success-subtle text-success",
    activeCls: "bg-success text-text-inverse",
  },
]
const FALLBACK: Pick<Bucket, "cls" | "activeCls"> = {
  cls: "bg-subtle text-text-secondary",
  activeCls: "bg-text-tertiary text-text-inverse",
}

function bucketFor(status: string): Pick<Bucket, "cls" | "activeCls"> {
  const lower = status.toLowerCase()
  return BUCKETS.find((b) => b.match.test(lower)) ?? FALLBACK
}

export function JiraIssueList({ issues, showAssignee }: Props) {
  const [filter, setFilter] = useState<string | null>(null)

  // 依 status 字串聚合計數，依 count 由多到少排序
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of issues) m.set(i.status, (m.get(i.status) ?? 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [issues])

  const filtered = filter ? issues.filter((i) => i.status === filter) : issues

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5 border-b border-border-subtle pb-3 text-xs">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`rounded-full px-2 py-0.5 ${
            filter === null ? "bg-text-primary text-text-inverse" : "bg-subtle text-text-secondary"
          }`}
        >
          全部 {issues.length}
        </button>
        {counts.map(([status, count]) => {
          const b = bucketFor(status)
          const active = filter === status
          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(active ? null : status)}
              className={`rounded-full px-2 py-0.5 ${active ? b.activeCls : b.cls}`}
            >
              {count} {status}
            </button>
          )
        })}
      </div>

      <ul className="max-h-96 space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <li className="py-4 text-center text-xs text-text-tertiary">這個狀態目前沒有票</li>
        )}
        {filtered.map((issue) => (
          <IssueRow key={issue.key} issue={issue} showAssignee={showAssignee} />
        ))}
      </ul>
    </>
  )
}

function IssueRow({ issue, showAssignee }: { issue: JiraIssue; showAssignee: boolean }) {
  const b = bucketFor(issue.status)
  return (
    <li className="rounded-md border border-border-subtle bg-canvas px-2.5 py-1.5">
      <a href={issue.url} target="_blank" rel="noreferrer" className="block min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-medium text-accent hover:text-accent-hover">
            {issue.key}
          </span>
          <span className={`rounded-full px-2 py-0.5 ${b.cls}`}>{issue.status}</span>
          <p className="min-w-0 flex-1 truncate text-sm text-text-primary">{issue.summary}</p>
        </div>
        {(showAssignee || issue.dueDate || issue.priority) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
            {showAssignee && <span>{issue.assigneeName}</span>}
            {issue.priority && <span>{issue.priority}</span>}
            {issue.dueDate && <span>截止 {issue.dueDate}</span>}
          </div>
        )}
      </a>
    </li>
  )
}
