"use client"

// 拆出來的 client 子元件 —— Jira issue 列表 + 固定 bucket 篩選 chips
// 父層（dashboard-jira-widget.tsx）仍是 server component，負責 fetch + 4 種 state 處理
// 只有 "ok" 分支會把 issues 傳進來這裡

import { useMemo, useState } from "react"
import type { JiraIssue } from "@/lib/jira"

interface Props {
  issues: JiraIssue[]
  showAssignee: boolean
}

// 固定 5 個 bucket（加「全部」共 6 顆 chip）
// 順序就是 chip 顯示順序：開放 → 進行中 → review → 已完成 → 其他
// match: null 代表 fallback bucket（其他），不靠關鍵字而是「沒被前面任何 bucket 撈到」就進來
type BucketId = "open" | "in_progress" | "review" | "done" | "other"
const BUCKETS: ReadonlyArray<{
  id: BucketId
  label: string
  match: RegExp | null
  cls: string
  activeCls: string
}> = [
  {
    id: "open",
    label: "開放",
    match: /todo|open|backlog|to do|new|selected/,
    cls: "bg-warning-subtle text-warning",
    activeCls: "bg-warning text-text-inverse",
  },
  {
    id: "in_progress",
    label: "進行中",
    match: /progress|doing|develop/,
    cls: "bg-accent-subtle text-accent",
    activeCls: "bg-accent text-text-inverse",
  },
  {
    id: "review",
    label: "Review",
    match: /review|qa|verify/,
    cls: "bg-info-subtle text-info",
    activeCls: "bg-info text-text-inverse",
  },
  {
    id: "done",
    label: "已完成",
    match: /done|closed|resolved|complete/,
    cls: "bg-success-subtle text-success",
    activeCls: "bg-success text-text-inverse",
  },
  {
    id: "other",
    label: "其他",
    match: null,
    cls: "bg-subtle text-text-secondary",
    activeCls: "bg-text-tertiary text-text-inverse",
  },
]

function bucketIdFor(status: string): BucketId {
  const lower = status.toLowerCase()
  for (const b of BUCKETS) {
    if (b.match?.test(lower)) return b.id
  }
  return "other"
}

function bucketStyleFor(status: string) {
  const id = bucketIdFor(status)
  const b = BUCKETS.find((x) => x.id === id)
  // BUCKETS 一定有 "other" fallback，這條 ! 一定不會炸
  return b ?? BUCKETS[BUCKETS.length - 1]
}

export function JiraIssueList({ issues, showAssignee }: Props) {
  const [filter, setFilter] = useState<BucketId | null>(null)

  // 每個 bucket 算一次 count（不管 0 都顯示，UI 才穩定）
  const countsByBucket = useMemo(() => {
    const m: Record<BucketId, number> = {
      open: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      other: 0,
    }
    for (const i of issues) m[bucketIdFor(i.status)]++
    return m
  }, [issues])

  const filtered = filter ? issues.filter((i) => bucketIdFor(i.status) === filter) : issues

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
        {BUCKETS.map((b) => {
          const count = countsByBucket[b.id]
          const active = filter === b.id
          // count = 0 也保留，但顯示稍微暗（讓 user 知道 bucket 在但目前沒票）
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setFilter(active ? null : b.id)}
              className={`rounded-full px-2 py-0.5 ${active ? b.activeCls : b.cls} ${
                count === 0 && !active ? "opacity-50" : ""
              }`}
            >
              {b.label} {count}
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
  const b = bucketStyleFor(issue.status)
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
