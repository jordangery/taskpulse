"use client"

// Jira 看板：5 個 bucket 各成一欄，每欄裡列出該狀態的 issue
// 父層（dashboard-jira-widget.tsx）server component 負責 fetch + 4 種 state 處理，
// 只有 "ok" 分支會把 issues 傳進來這裡
//
// 響應式：lg 5 欄、md 2 欄、行動裝置 1 欄；空 bucket 不收起，固定欄位讓眼睛習慣位置
//
// bucket 邏輯（regex + 色票）抽到 src/lib/jira-buckets.ts 共享給 team summary 用

import { useMemo } from "react"
import type { JiraIssue } from "@/lib/jira"
import {
  BUCKETS,
  type BucketId,
  bucketDefFor,
  bucketIdFor,
  DISPLAY_ORDER,
} from "@/lib/jira-buckets"

interface Props {
  issues: JiraIssue[]
  showAssignee: boolean
}

export function JiraIssueList({ issues, showAssignee }: Props) {
  // 把 issues 依 bucket 分群
  const byBucket = useMemo(() => {
    const m: Record<BucketId, JiraIssue[]> = {
      open: [],
      in_progress: [],
      review: [],
      done: [],
      other: [],
    }
    for (const i of issues) m[bucketIdFor(i.status)].push(i)
    return m
  }, [issues])

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
      {DISPLAY_ORDER.map((id) => {
        const bucket = BUCKETS.find((x) => x.id === id)
        if (!bucket) return null
        const items = byBucket[id]
        return (
          <KanbanColumn
            key={id}
            label={bucket.label}
            count={items.length}
            headerCls={bucket.cls}
            items={items}
            showAssignee={showAssignee}
          />
        )
      })}
    </div>
  )
}

function KanbanColumn({
  label,
  count,
  headerCls,
  items,
  showAssignee,
}: {
  label: string
  count: number
  headerCls: string
  items: JiraIssue[]
  showAssignee: boolean
}) {
  return (
    <div className="flex flex-col rounded-md border border-border-subtle bg-canvas">
      <header
        className={`flex items-center justify-between rounded-t-md px-3 py-1.5 text-xs font-medium ${headerCls}`}
      >
        <span>{label}</span>
        <span className="opacity-75">{count}</span>
      </header>
      <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto p-2">
        {items.length === 0 ? (
          <li className="py-3 text-center text-[11px] text-text-tertiary">—</li>
        ) : (
          items.map((issue) => (
            <IssueCard key={issue.key} issue={issue} showAssignee={showAssignee} />
          ))
        )}
      </ul>
    </div>
  )
}

function IssueCard({ issue, showAssignee }: { issue: JiraIssue; showAssignee: boolean }) {
  const b = bucketDefFor(issue.status)
  return (
    <li className="rounded-md border border-border-subtle bg-surface px-2.5 py-2 hover:border-border-default">
      <a href={issue.url} target="_blank" rel="noreferrer" className="block min-w-0">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="font-mono font-medium text-accent hover:text-accent-hover">
            {issue.key}
          </span>
          <span className={`truncate rounded-full px-1.5 py-0 ${b.cls}`} title={issue.status}>
            {issue.status}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-text-primary">{issue.summary}</p>
        {(showAssignee || issue.dueDate || issue.priority) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-tertiary">
            {showAssignee && <span>{issue.assigneeName}</span>}
            {issue.priority && <span>{issue.priority}</span>}
            {issue.dueDate && <span>截止 {issue.dueDate}</span>}
          </div>
        )}
      </a>
    </li>
  )
}
