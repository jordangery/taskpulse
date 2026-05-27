"use client"

// Dashboard「每人未完成 Jira 票」卡內元件
// 3-col grid，每人一張卡：名字 + 進度條 + 票數 + bucket 細分 chips
// 預設全部展開，點任一張可收合；展開時 max-h + scroll 限制單卡高度

import { useMemo, useState } from "react"
import type { JiraIssue } from "@/lib/jira"
import { BUCKETS, type BucketId, bucketDefFor, DISPLAY_ORDER } from "@/lib/jira-buckets"

interface PersonOpenJira {
  name: string
  count: number
  issues: JiraIssue[]
}

interface Props {
  data: PersonOpenJira[]
}

// 預先建好 BucketId → 顯示 def 對照
const BUCKET_DEF: Record<BucketId, (typeof BUCKETS)[number]> = (() => {
  const out = {} as Record<BucketId, (typeof BUCKETS)[number]>
  for (const b of BUCKETS) out[b.id] = b
  return out
})()

// 「需注意」的 bucket：尚未啟動或狀態異常的票
const ATTENTION_BUCKETS: BucketId[] = ["open", "other"]

export function PeopleOpenJira({ data }: Props) {
  // 3-col grid 排版，預設全部展開（items-start 讓 grid cell 不撐高）
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(data.map((d) => d.name)))

  // 每人的 bucket 細分（用 useMemo 因為 jiraIssues 不會頻繁變）
  const bucketCounts = useMemo(() => {
    const map = new Map<string, Record<BucketId, number>>()
    for (const person of data) {
      const counts: Record<BucketId, number> = {
        open: 0,
        in_progress: 0,
        review: 0,
        done: 0,
        other: 0,
      }
      for (const issue of person.issues) {
        const def = bucketDefFor(issue.status)
        counts[def.id]++
      }
      map.set(person.name, counts)
    }
    return map
  }, [data])

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border-default bg-canvas text-sm text-text-tertiary">
        目前沒有人有未完成的 Jira 票 🎉
      </div>
    )
  }

  // 進度條基準：取目前最高人數作為 100%
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <ul className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((person) => {
        const isOpen = expanded.has(person.name)
        const pct = Math.round((person.count / maxCount) * 100)
        const counts = bucketCounts.get(person.name) ?? {
          open: 0,
          in_progress: 0,
          review: 0,
          done: 0,
          other: 0,
        }
        // 該員有幾張票卡在「待處理」狀態（open + other）— 用來決定要不要打 ⚠️ 標
        const attentionCount = ATTENTION_BUCKETS.reduce((sum, id) => sum + counts[id], 0)

        return (
          <li
            key={person.name}
            className={`overflow-hidden rounded-md border bg-canvas ${
              attentionCount > 0 ? "border-warning" : "border-border-subtle"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(person.name)}
              aria-expanded={isOpen}
              className="block w-full px-3 py-2 text-left transition hover:bg-subtle"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 truncate text-sm font-medium text-text-primary">
                  <span className="text-text-tertiary text-xs">{isOpen ? "▼" : "▶"}</span>
                  {person.name}
                  {attentionCount > 0 && (
                    <span
                      className="ml-0.5 rounded-full bg-warning-subtle px-1.5 py-0.5 text-[10px] font-medium text-warning"
                      title={`${attentionCount} 張待處理 / 狀態異常`}
                    >
                      ⚠ {attentionCount}
                    </span>
                  )}
                </span>
                <span className="flex-shrink-0 text-xs text-text-secondary">
                  共 {person.count} 張
                </span>
              </div>
              {/* 進度條 — 寬度 = 該人 count / 最高人 count */}
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle"
                role="progressbar"
                aria-valuenow={person.count}
                aria-valuemin={0}
                aria-valuemax={maxCount}
              >
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {/* Bucket 細分 chips — 一眼看 backlog / 進行 / review 比例 */}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {DISPLAY_ORDER.filter((id) => id !== "done" && counts[id] > 0).map((id) => {
                  const def = BUCKET_DEF[id]
                  return (
                    <span
                      key={id}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${def.cls}`}
                    >
                      {def.label} {counts[id]}
                    </span>
                  )
                })}
              </div>
            </button>

            {isOpen && (
              <div className="max-h-96 overflow-y-auto">
                <IssueList issues={person.issues} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function IssueList({ issues }: { issues: JiraIssue[] }) {
  return (
    <ul className="border-t border-border-subtle bg-surface">
      {issues.map((issue) => {
        const def = bucketDefFor(issue.status)
        return (
          <li
            key={issue.key}
            className="border-b border-border-subtle last:border-b-0 hover:bg-subtle"
          >
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs font-medium text-accent">{issue.key}</span>
                {/* 狀態 badge：用 bucket 配色，醒目（取代之前的灰色小字） */}
                <span
                  className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${def.cls}`}
                  title={issue.status}
                >
                  {issue.status}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-text-primary">{issue.summary}</p>
              {(issue.dueDate || issue.priority || issue.fixVersions.length > 0) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-tertiary">
                  {issue.dueDate && <DueDateChip due={issue.dueDate} />}
                  {issue.priority && <span>· {issue.priority}</span>}
                  {issue.fixVersions.length > 0 && (
                    <span className="rounded bg-subtle px-1.5 py-0.5 text-text-secondary">
                      v{issue.fixVersions.join(" / ")}
                    </span>
                  )}
                  {issue.issueType && <span>· {issue.issueType}</span>}
                </div>
              )}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

function DueDateChip({ due }: { due: string }) {
  // due 是 YYYY-MM-DD (local)，標出今天 / 已逾期 / 還有幾天
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const isOverdue = due < todayKey
  const isToday = due === todayKey

  if (isOverdue) {
    return <span className="font-medium text-danger">⏰ {due}（已逾期）</span>
  }
  if (isToday) {
    return <span className="font-medium text-warning">⏰ {due}（今天）</span>
  }
  return <span>⏰ {due}</span>
}
