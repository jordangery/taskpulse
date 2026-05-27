"use client"

// Dashboard「每人未完成 Jira 票」卡內元件
// 取代純圖表的 ChartPeopleTasks：每人一列 = 名字 + 進度條 + 票數
// 點任一列展開該人的票清單（單一展開、再點關閉）

import { useState } from "react"
import type { JiraIssue } from "@/lib/jira"

interface PersonOpenJira {
  name: string
  count: number
  issues: JiraIssue[]
}

interface Props {
  data: PersonOpenJira[]
}

export function PeopleOpenJira({ data }: Props) {
  // 3-col grid 排版，預設全部展開（items-start 讓 grid cell 不撐高、各卡片照自己高度顯示）
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(data.map((d) => d.name)))

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
        return (
          <li
            key={person.name}
            className="overflow-hidden rounded-md border border-border-subtle bg-canvas"
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
                </span>
                <span className="flex-shrink-0 text-xs text-text-secondary">{person.count} 張</span>
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
      {issues.map((issue) => (
        <li
          key={issue.key}
          className="border-b border-border-subtle last:border-b-0 hover:bg-subtle"
        >
          <a href={issue.url} target="_blank" rel="noopener noreferrer" className="block px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs font-medium text-accent">{issue.key}</span>
              <span className="flex-shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
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
      ))}
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
