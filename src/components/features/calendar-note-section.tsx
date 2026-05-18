"use client"

// 日曆某一天的記事列表 + 新增表單 + 編輯 / 刪除
// 父層（/calendar/[date]/page.tsx）server fetch 後傳 notes + meta 進來
// 自己用 useTransition 跑 server actions、用 router.refresh 重撈
//
// 權限：
//   建立：任何登入 user
//   編輯：只有作者本人
//   刪除：作者本人 OR admin

import { formatDistanceToNowStrict } from "date-fns"
import { zhTW } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  createCalendarNote,
  deleteCalendarNote,
  updateCalendarNote,
} from "@/lib/actions/calendar-notes"

interface Note {
  id: string
  content: string
  authorId: string
  author: { id: string; name: string }
  createdAt: Date
  updatedAt: Date
}

interface Props {
  dateKey: string
  notes: Note[]
  currentUserId: string
  currentUserRole: "admin" | "member"
}

export function CalendarNoteSection({ dateKey, notes, currentUserId, currentUserRole }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    setError(null)
    startTransition(async () => {
      const res = await createCalendarNote({ dateKey, content })
      if (!res.success) {
        setError(res.error)
        return
      }
      setDraft("")
      router.refresh()
    })
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-text-secondary">
        記事
        {notes.length > 0 && <span className="ml-2 text-text-tertiary">（{notes.length}）</span>}
      </h2>

      {notes.length > 0 && (
        <ul className="mb-3 space-y-2">
          {notes.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-md border border-border-subtle bg-surface px-4 py-3"
      >
        <label htmlFor="note-content" className="mb-1 block text-xs text-text-tertiary">
          這天的備忘（休假 / 開會 / 出差…，跟 Task / Jira 無關的記事都丟這）
        </label>
        <textarea
          id="note-content"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="例：下午半天請假 / Team 全員週會 / 出差 …"
          rows={2}
          maxLength={500}
          className="block w-full resize-y rounded-md border border-border-default bg-canvas px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-text-tertiary">{draft.length}/500</span>
          <button
            type="submit"
            disabled={pending || draft.trim().length === 0}
            className="rounded-md bg-primary px-3 py-1 text-text-inverse hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? "送出中…" : "新增記事"}
          </button>
        </div>
      </form>
    </section>
  )
}

function NoteRow({
  note,
  currentUserId,
  currentUserRole,
}: {
  note: Note
  currentUserId: string
  currentUserRole: "admin" | "member"
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.content)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isOwn = note.authorId === currentUserId
  const canDelete = isOwn || currentUserRole === "admin"
  const wasEdited = note.updatedAt.getTime() - note.createdAt.getTime() > 1000

  const handleSave = () => {
    const content = draft.trim()
    if (!content) return
    setError(null)
    startTransition(async () => {
      const res = await updateCalendarNote(note.id, { content })
      if (!res.success) {
        setError(res.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!confirm("確定刪除這則記事？")) return
    startTransition(async () => {
      await deleteCalendarNote(note.id)
      router.refresh()
    })
  }

  if (editing) {
    return (
      <li className="rounded-md border border-border-default bg-canvas px-3 py-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={500}
          className="block w-full resize-y rounded-md border border-border-default bg-surface px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        <div className="mt-2 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setEditing(false)
              setDraft(note.content)
              setError(null)
            }}
            className="text-text-tertiary hover:text-text-secondary"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-md bg-primary px-2 py-1 text-text-inverse hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? "存…" : "存"}
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="rounded-md border border-border-subtle bg-surface px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-text-primary">
          {note.content}
        </p>
        <div className="flex flex-shrink-0 items-center gap-1 text-xs">
          {isOwn && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md px-2 py-0.5 text-text-tertiary hover:bg-subtle hover:text-text-secondary"
            >
              編輯
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="rounded-md px-2 py-0.5 text-danger hover:bg-danger-subtle disabled:opacity-50"
            >
              刪除
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-text-tertiary">
        {note.author.name}｜{formatDistanceToNowStrict(note.createdAt, { locale: zhTW })}前
        {wasEdited && " · 已編輯"}
      </p>
    </li>
  )
}
