"use client"

// Jira issue 顯示元件，兩種 view：
//   - "list"   chip 篩選 + 單欄列表（給「我的 Jira」用，空間小）
//   - "kanban" 5 欄看板（給「團隊 Jira」用）
//
// 父層（dashboard-jira-widget.tsx）server component 負責 fetch + 4 種 state 處理，
// 只有 "ok" 分支會把 issues 傳進來這裡
//
// bucket 邏輯（regex + 色票）抽到 src/lib/jira-buckets.ts 共享給 team summary 用

import { formatDistanceToNowStrict } from "date-fns"
import { zhTW } from "date-fns/locale"
import { useMemo, useState } from "react"
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
  view: "list" | "kanban"
}

export function JiraIssueList({ issues, showAssignee, view }: Props) {
  // 永遠先依 bucket 分群（kanban 直接用；list view 也用來算 chip count）
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

  if (view === "kanban") {
    return <KanbanView byBucket={byBucket} showAssignee={showAssignee} />
  }
  return <ListView issues={issues} byBucket={byBucket} showAssignee={showAssignee} />
}

// ---------- LIST VIEW (chip + 單欄列表) ----------

function ListView({
  issues,
  byBucket,
  showAssignee,
}: {
  issues: JiraIssue[]
  byBucket: Record<BucketId, JiraIssue[]>
  showAssignee: boolean
}) {
  const [filter, setFilter] = useState<BucketId | null>(null)
  const filtered = filter ? byBucket[filter] : issues

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
        {DISPLAY_ORDER.map((id) => {
          const b = BUCKETS.find((x) => x.id === id)
          if (!b) return null
          const count = byBucket[id].length
          const active = filter === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(active ? null : id)}
              className={`rounded-full px-2 py-0.5 ${active ? b.activeCls : b.cls} ${
                count === 0 && !active ? "opacity-50" : ""
              }`}
            >
              {b.label} {count}
            </button>
          )
        })}
      </div>

      <ul className="scrollbar-subtle max-h-96 space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <li className="py-4 text-center text-xs text-text-tertiary">這個狀態目前沒有票</li>
        ) : (
          filtered.map((issue) => (
            <IssueRow key={issue.key} issue={issue} showAssignee={showAssignee} />
          ))
        )}
      </ul>
    </>
  )
}

function IssueRow({ issue, showAssignee }: { issue: JiraIssue; showAssignee: boolean }) {
  const b = bucketDefFor(issue.status)
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
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
          {showAssignee && <span>{issue.assigneeName}</span>}
          {issue.priority && <span>{issue.priority}</span>}
          {issue.dueDate && <span>截止 {issue.dueDate}</span>}
          <StalePill updated={issue.updated} />
        </div>
      </a>
    </li>
  )
}

// ---------- KANBAN VIEW ----------

function KanbanView({
  byBucket,
  showAssignee,
}: {
  byBucket: Record<BucketId, JiraIssue[]>
  showAssignee: boolean
}) {
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
      <ul className="scrollbar-subtle flex max-h-80 flex-col gap-1.5 overflow-y-auto p-2">
        {items.length === 0 ? (
          <li className="py-3 text-center text-[11px] text-text-tertiary">—</li>
        ) : (
          items.map((issue) => (
            <KanbanCard key={issue.key} issue={issue} showAssignee={showAssignee} />
          ))
        )}
      </ul>
    </div>
  )
}

function KanbanCard({ issue, showAssignee }: { issue: JiraIssue; showAssignee: boolean }) {
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
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-tertiary">
          {showAssignee && <span>{issue.assigneeName}</span>}
          {issue.priority && <span>{issue.priority}</span>}
          {issue.dueDate && <span>截止 {issue.dueDate}</span>}
          <StalePill updated={issue.updated} compact />
        </div>
      </a>
    </li>
  )
}

// ---------- Stale time pill ----------
// 顯示「X 天/小時 沒更新」；> 7 天標 warning 顏色提醒
function StalePill({ updated, compact = false }: { updated: string | null; compact?: boolean }) {
  if (!updated) return null
  const d = new Date(updated)
  if (Number.isNaN(d.getTime())) return null
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
  const isStale = days >= 7
  // 用 strict 確保「3 天前」不會跑成「3 天前後」之類；接 zhTW 語系
  const label = formatDistanceToNowStrict(d, { locale: zhTW }) + (compact ? "" : "沒更新")
  return (
    <span
      title={d.toLocaleString("zh-TW")}
      className={isStale ? "text-warning" : "text-text-tertiary"}
    >
      {compact ? label : `· ${label}`}
    </span>
  )
}
