"use client"

// 日曆某一天的事件列表 + 新增 + 編輯 + 刪除
// 跟 CalendarNoteSection 同層級，但屬性不同：
//   - 跨多天（startDate / endDate）
//   - 多人參與（participants）
//   - 標題 + 描述（比 note 結構化）
// 權限：建立 = 任意 user；編輯 / 刪除 = creator OR admin

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { createEvent, deleteEvent, updateEvent } from "@/lib/actions/events"
import type { EventFormValues } from "@/lib/schemas/event"

interface Participant {
  user: { id: string; name: string }
}
export interface EventRow {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  creatorId: string
  creator: { id: string; name: string }
  participants: Participant[]
}
interface UserOption {
  id: string
  name: string
  role: "admin" | "member"
}

interface Props {
  dateKey: string
  events: EventRow[]
  candidates: UserOption[]
  currentUserId: string
  currentUserRole: "admin" | "member"
}

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function CalendarEventSection({
  dateKey,
  events,
  candidates,
  currentUserId,
  currentUserRole,
}: Props) {
  const [creating, setCreating] = useState(false)

  return (
    <section>
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-secondary">
          事件
          {events.length > 0 && (
            <span className="ml-2 text-text-tertiary">（{events.length}）</span>
          )}
        </h2>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-md border border-border-subtle bg-canvas px-2 py-0.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary"
          >
            + 新增事件
          </button>
        )}
      </header>

      {creating && (
        <EventForm
          defaultStart={dateKey}
          defaultEnd={dateKey}
          candidates={candidates}
          onCancel={() => setCreating(false)}
          onSubmit={async (data) => {
            const r = await createEvent(data)
            return r
          }}
          onSuccess={() => setCreating(false)}
        />
      )}

      {events.length === 0 && !creating ? (
        <p className="rounded-md border border-dashed border-border-default bg-surface px-4 py-6 text-center text-xs text-text-tertiary">
          這天沒有事件
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <EventRowItem
              key={ev.id}
              event={ev}
              candidates={candidates}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function EventRowItem({
  event: ev,
  candidates,
  currentUserId,
  currentUserRole,
}: {
  event: EventRow
  candidates: UserOption[]
  currentUserId: string
  currentUserRole: "admin" | "member"
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  const isMultiDay = toDateKey(ev.startDate) !== toDateKey(ev.endDate)
  const canEdit = ev.creatorId === currentUserId || currentUserRole === "admin"

  if (editing) {
    return (
      <li>
        <EventForm
          defaultTitle={ev.title}
          defaultDescription={ev.description ?? ""}
          defaultStart={toDateKey(ev.startDate)}
          defaultEnd={toDateKey(ev.endDate)}
          defaultParticipantIds={ev.participants.map((p) => p.user.id)}
          candidates={candidates}
          onCancel={() => setEditing(false)}
          onSubmit={async (data) => {
            const r = await updateEvent(ev.id, data)
            return r
          }}
          onSuccess={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="rounded-md border border-border-subtle bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-primary">{ev.title}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">
            {isMultiDay
              ? `${toDateKey(ev.startDate)} ~ ${toDateKey(ev.endDate)}`
              : toDateKey(ev.startDate)}
            <span className="mx-1.5">·</span>
            建立者 {ev.creator.name}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-shrink-0 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md px-2 py-0.5 text-text-tertiary hover:bg-subtle hover:text-text-secondary"
            >
              編輯
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(`確定刪除事件「${ev.title}」？`)) return
                startTransition(async () => {
                  await deleteEvent(ev.id)
                  router.refresh()
                })
              }}
              className="rounded-md px-2 py-0.5 text-danger hover:bg-danger-subtle disabled:opacity-50"
            >
              刪除
            </button>
          </div>
        )}
      </div>
      {ev.description && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{ev.description}</p>
      )}
      {ev.participants.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ev.participants.map((p) => (
            <span
              key={p.user.id}
              className="rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] text-accent"
            >
              {p.user.name}
            </span>
          ))}
        </div>
      )}
    </li>
  )
}

function EventForm({
  defaultTitle = "",
  defaultDescription = "",
  defaultStart,
  defaultEnd,
  defaultParticipantIds = [],
  candidates,
  onCancel,
  onSubmit,
  onSuccess,
}: {
  defaultTitle?: string
  defaultDescription?: string
  defaultStart: string
  defaultEnd: string
  defaultParticipantIds?: string[]
  candidates: UserOption[]
  onCancel: () => void
  onSubmit: (
    data: EventFormValues,
  ) => Promise<{ success: true; data: { id: string } } | { success: false; error: string }>
  onSuccess: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState(defaultDescription)
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)
  const [participantIds, setParticipantIds] = useState<string[]>(defaultParticipantIds)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        startDateKey: start,
        endDateKey: end,
        participantIds,
      })
      if (!r.success) {
        setError(r.error)
        return
      }
      router.refresh()
      onSuccess()
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 space-y-3 rounded-md border border-border-default bg-surface px-4 py-3"
    >
      <div>
        <label htmlFor="ev-title" className="mb-1 block text-xs text-text-secondary">
          標題
        </label>
        <input
          id="ev-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-border-default bg-canvas px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
          maxLength={120}
        />
      </div>
      <div>
        <label htmlFor="ev-desc" className="mb-1 block text-xs text-text-secondary">
          描述（選填）
        </label>
        <textarea
          id="ev-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={1000}
          className="w-full rounded-md border border-border-default bg-canvas px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ev-start" className="mb-1 block text-xs text-text-secondary">
            開始
          </label>
          <input
            id="ev-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-md border border-border-default bg-canvas px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label htmlFor="ev-end" className="mb-1 block text-xs text-text-secondary">
            結束
          </label>
          <input
            id="ev-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded-md border border-border-default bg-canvas px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-text-secondary">參與者（可選；複選）</p>
        <div className="scrollbar-subtle flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border-default bg-canvas p-2">
          {candidates.map((u) => {
            const selected = participantIds.includes(u.id)
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setParticipantIds((prev) =>
                    prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id],
                  )
                }}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  selected
                    ? "bg-accent-subtle text-accent"
                    : "bg-subtle text-text-secondary hover:bg-canvas hover:text-text-primary"
                }`}
              >
                {u.name}
                {u.role === "admin" && <span className="ml-1 text-[10px] opacity-70">(主管)</span>}
              </button>
            )
          })}
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-text-tertiary hover:text-text-secondary"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={pending || title.trim().length === 0}
          className="rounded-md bg-primary px-3 py-1 text-text-inverse hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "送出中…" : "送出"}
        </button>
      </div>
    </form>
  )
}
