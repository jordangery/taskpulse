"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { STATUS_SUGGESTIONS } from "@/lib/schemas/progress-update"

interface Assignee {
  id: string
  name: string
}

interface TaskListFiltersProps {
  assignees?: Assignee[] // admin 才傳；member 不顯示 assignee 選項
}

export const SORT_OPTIONS = [
  { value: "created", label: "建立時間（新到舊）" },
  { value: "due", label: "截止日（近到遠）" },
  { value: "activity", label: "最近活動" },
] as const

export type SortValue = (typeof SORT_OPTIONS)[number]["value"]

export function TaskListFilters({ assignees }: TaskListFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  // URL → state (controlled inputs)
  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [assignee, setAssignee] = useState(searchParams.get("assignee") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "")
  const [overdue, setOverdue] = useState(searchParams.get("overdue") === "1")
  const [sort, setSort] = useState<SortValue>((searchParams.get("sort") as SortValue) || "created")

  // URL 變動同步回 state（瀏覽器上下一頁等情境）
  useEffect(() => {
    setQ(searchParams.get("q") ?? "")
    setAssignee(searchParams.get("assignee") ?? "")
    setStatus(searchParams.get("status") ?? "")
    setOverdue(searchParams.get("overdue") === "1")
    setSort((searchParams.get("sort") as SortValue) || "created")
  }, [searchParams])

  function pushUrl(next: {
    q?: string
    assignee?: string
    status?: string
    overdue?: boolean
    sort?: SortValue
  }) {
    const params = new URLSearchParams()
    if (next.q && next.q.length > 0) params.set("q", next.q)
    if (next.assignee && next.assignee.length > 0) params.set("assignee", next.assignee)
    if (next.status && next.status.length > 0) params.set("status", next.status)
    if (next.overdue) params.set("overdue", "1")
    if (next.sort && next.sort !== "created") params.set("sort", next.sort)
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  // search 用 debounce 避免每打一字推一次 URL
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只想對 q 變化 debounce，其他 state 變動已 immediate push
  useEffect(() => {
    const currentInUrl = searchParams.get("q") ?? ""
    if (q === currentInUrl) return
    const t = setTimeout(() => {
      pushUrl({ q, assignee, status, overdue, sort })
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  const hasAnyFilter = q || assignee || status || overdue || sort !== "created"

  return (
    <div className="mb-4 rounded-md border border-border-subtle bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="搜尋任務標題 / 描述…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border-default bg-canvas px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {assignees && assignees.length > 0 && (
          <select
            value={assignee}
            onChange={(e) => {
              setAssignee(e.target.value)
              pushUrl({ q, assignee: e.target.value, status, overdue, sort })
            }}
            className="rounded-md border border-border-default bg-canvas px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">全部成員</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            pushUrl({ q, assignee, status: e.target.value, overdue, sort })
          }}
          className="rounded-md border border-border-default bg-canvas px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">全部狀態</option>
          {STATUS_SUGGESTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => {
              setOverdue(e.target.checked)
              pushUrl({ q, assignee, status, overdue: e.target.checked, sort })
            }}
            className="accent-accent"
          />
          只看逾期
        </label>
        <select
          value={sort}
          onChange={(e) => {
            const newSort = e.target.value as SortValue
            setSort(newSort)
            pushUrl({ q, assignee, status, overdue, sort: newSort })
          }}
          className="rounded-md border border-border-default bg-canvas px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={() => {
              setQ("")
              setAssignee("")
              setStatus("")
              setOverdue(false)
              setSort("created")
              pushUrl({ q: "", assignee: "", status: "", overdue: false, sort: "created" })
            }}
            className="text-xs text-text-tertiary hover:text-text-secondary"
          >
            清除全部
          </button>
        )}
      </div>
    </div>
  )
}
