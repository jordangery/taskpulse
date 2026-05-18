"use client"

// 團隊 Jira 看板上方的總結區
// 1. 4 個統計 tile：未執行 / 處理中 / 已逾期 / 久未更新
// 2. 「今天該追的人」清單：列出有逾期或久未更新的人，依緊急程度排序

import { useMemo } from "react"
import type { JiraIssue } from "@/lib/jira"
import { bucketIdFor } from "@/lib/jira-buckets"

interface Props {
  issues: JiraIssue[]
}

const STALE_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

interface PersonRollup {
  name: string
  overdue: number
  stale: number
}

export function TeamJiraSummary({ issues }: Props) {
  const summary = useMemo(() => computeSummary(issues), [issues])

  return (
    <div className="mb-4 space-y-3 rounded-md border border-border-subtle bg-canvas p-3">
      {/* 4 stat tiles */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="未執行" value={summary.openCount} cls="text-warning" />
        <StatTile label="處理中" value={summary.inProgressCount} cls="text-accent" />
        <StatTile label="已逾期" value={summary.overdueCount} cls="text-danger" />
        <StatTile
          label={`久未更新 >${STALE_DAYS}d`}
          value={summary.staleCount}
          cls="text-text-secondary"
        />
      </div>

      {/* 今天該追的人 */}
      <div>
        <h3 className="mb-1.5 text-xs font-medium text-text-secondary">
          今天該追的人
          {summary.peopleToFollow.length > 0 && (
            <span className="ml-2 text-text-tertiary">（{summary.peopleToFollow.length} 個）</span>
          )}
        </h3>
        {summary.peopleToFollow.length === 0 ? (
          <p className="rounded-md bg-surface px-3 py-2 text-xs text-text-tertiary">
            目前沒人有逾期或久未更新的單 ✓
          </p>
        ) : (
          <ul className="space-y-1">
            {summary.peopleToFollow.map((p) => (
              <li
                key={p.name}
                className="flex items-center gap-2 rounded-md bg-surface px-3 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
                  {p.name}
                </span>
                {p.overdue > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-danger-subtle px-2 py-0.5 text-danger">
                    {p.overdue} 逾期
                  </span>
                )}
                {p.stale > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-warning-subtle px-2 py-0.5 text-warning">
                    {p.stale} 久未更新
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-md bg-surface px-3 py-2">
      <p className="text-[10px] text-text-tertiary">{label}</p>
      <p className={`text-xl font-semibold ${cls}`}>{value}</p>
    </div>
  )
}

function computeSummary(issues: JiraIssue[]): {
  openCount: number
  inProgressCount: number
  overdueCount: number
  staleCount: number
  peopleToFollow: PersonRollup[]
} {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const staleCutoffMs = today.getTime() - STALE_DAYS * MS_PER_DAY

  let openCount = 0
  let inProgressCount = 0
  let overdueCount = 0
  let staleCount = 0

  const perPerson = new Map<string, PersonRollup>()

  for (const issue of issues) {
    const bucket = bucketIdFor(issue.status)
    // 已完成不需要追，跳過
    if (bucket === "done") continue

    if (bucket === "open") openCount++
    if (bucket === "in_progress") inProgressCount++

    const isOverdue = issue.dueDate ? new Date(issue.dueDate) < today : false
    // overdue 跟 stale 二選一（避免同一筆票兩邊都計算）
    const isStale =
      !isOverdue && issue.updated ? new Date(issue.updated).getTime() < staleCutoffMs : false

    if (isOverdue) overdueCount++
    if (isStale) staleCount++

    if (isOverdue || isStale) {
      const p = perPerson.get(issue.assigneeName) ?? {
        name: issue.assigneeName,
        overdue: 0,
        stale: 0,
      }
      if (isOverdue) p.overdue++
      else if (isStale) p.stale++
      perPerson.set(issue.assigneeName, p)
    }
  }

  const peopleToFollow = Array.from(perPerson.values()).sort((a, b) => {
    if (b.overdue !== a.overdue) return b.overdue - a.overdue
    return b.stale - a.stale
  })

  return { openCount, inProgressCount, overdueCount, staleCount, peopleToFollow }
}
