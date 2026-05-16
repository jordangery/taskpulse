"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { createFeedback, updateFeedback } from "@/lib/actions/feedbacks"
import { type FeedbackFormValues, feedbackFormSchema } from "@/lib/schemas/feedback"

interface FeedbackData {
  id: string
  content: string
  createdAt: string // ISO string，方便 server→client 序列化
  updatedAt: string
  author: { id: string; name: string }
}

interface FeedbackSectionProps {
  progressUpdateId: string
  feedback: FeedbackData | null
  isAdmin: boolean
}

export function FeedbackSection({ progressUpdateId, feedback, isAdmin }: FeedbackSectionProps) {
  const [editing, setEditing] = useState(false)

  // 沒回饋 + 不是 admin → 完全不顯示
  if (!feedback && !isAdmin) return null

  // 沒回饋 + admin → 「寫回饋」按鈕或表單
  if (!feedback) {
    if (!editing) {
      return (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-accent hover:text-accent-hover"
          >
            + 寫回饋
          </button>
        </div>
      )
    }
    return (
      <FeedbackEditor
        mode="create"
        progressUpdateId={progressUpdateId}
        onClose={() => setEditing(false)}
      />
    )
  }

  // 有回饋 + admin + 編輯中 → 編輯表單（預填 content）
  if (editing && isAdmin) {
    return (
      <FeedbackEditor
        mode="edit"
        feedbackId={feedback.id}
        defaultContent={feedback.content}
        onClose={() => setEditing(false)}
      />
    )
  }

  // 有回饋 → 顯示（admin 多一個「編輯」按鈕）
  return <FeedbackDisplay feedback={feedback} isAdmin={isAdmin} onEdit={() => setEditing(true)} />
}

function FeedbackDisplay({
  feedback,
  isAdmin,
  onEdit,
}: {
  feedback: FeedbackData
  isAdmin: boolean
  onEdit: () => void
}) {
  const created = new Date(feedback.createdAt)
  const updated = new Date(feedback.updatedAt)
  const edited = updated.getTime() - created.getTime() > 1000

  return (
    <aside
      // bg-info-subtle + 左側 3px border-accent：跟 design-system.md「主管的回饋」規範一致
      className="mt-3 rounded-r-md border-l-[3px] border-accent bg-info-subtle px-4 py-3"
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-accent">回饋</span>
          <span className="text-text-tertiary">— {feedback.author.name}</span>
          <span className="text-text-tertiary">
            {formatDistanceToNow(created, { locale: zhTW, addSuffix: true })}
          </span>
          {edited && (
            <span className="text-text-tertiary">
              （編輯於 {formatDistanceToNow(updated, { locale: zhTW, addSuffix: true })}）
            </span>
          )}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-accent hover:text-accent-hover"
          >
            編輯
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-text-primary">{feedback.content}</p>
    </aside>
  )
}

type EditorProps =
  | { mode: "create"; progressUpdateId: string; onClose: () => void }
  | { mode: "edit"; feedbackId: string; defaultContent: string; onClose: () => void }

function FeedbackEditor(props: EditorProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      content: props.mode === "edit" ? props.defaultContent : "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true)
    setServerError(null)
    const result =
      props.mode === "create"
        ? await createFeedback(props.progressUpdateId, data)
        : await updateFeedback(props.feedbackId, data)
    setSubmitting(false)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    props.onClose()
    router.refresh()
  })

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 space-y-2 rounded-r-md border-l-[3px] border-accent bg-info-subtle px-4 py-3"
    >
      <label htmlFor={`fb-${props.mode}`} className="block text-xs font-medium text-accent">
        {props.mode === "create" ? "寫回饋" : "編輯回饋"}
      </label>
      <textarea
        id={`fb-${props.mode}`}
        rows={3}
        placeholder="針對這次的進度，給點具體意見…"
        {...form.register("content")}
        className="w-full resize-y rounded-md border border-border-default bg-canvas px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {form.formState.errors.content && (
        <p className="text-xs text-danger">{form.formState.errors.content.message}</p>
      )}
      {serverError && (
        <div className="rounded-md bg-danger-subtle px-3 py-1.5 text-xs text-danger">
          {serverError}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-md border border-border-default bg-surface px-3 py-1.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-text-inverse hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "送出中…" : props.mode === "create" ? "送出回饋" : "儲存"}
        </button>
      </div>
    </form>
  )
}
