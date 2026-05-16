"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { createFeedback, updateFeedback } from "@/lib/actions/feedbacks"
import { type FeedbackFormValues, feedbackFormSchema } from "@/lib/schemas/feedback"

export interface FeedbackThreadItem {
  id: string
  content: string
  createdAt: string // ISO string，server→client 序列化
  updatedAt: string
  author: { id: string; name: string }
}

interface FeedbackSectionProps {
  progressUpdateId: string
  feedbacks: FeedbackThreadItem[]
  currentUserId: string | null
  canReply: boolean
  // 任務列表只取最新 N 則顯示，更早的縮成提示 + 跳詳情頁
  truncated?: { hiddenOlderCount: number; detailLink: string }
}

// 回饋從 1對1 改成留言串：任何相關人員都能回應、各自能編輯自己的
export function FeedbackSection({
  progressUpdateId,
  feedbacks,
  currentUserId,
  canReply,
  truncated,
}: FeedbackSectionProps) {
  // 不顯示條件：沒留言 + 不能回應
  if (feedbacks.length === 0 && !canReply) return null

  return (
    <section className="mt-3 space-y-2">
      {truncated && truncated.hiddenOlderCount > 0 && (
        <Link
          href={truncated.detailLink}
          className="block text-xs text-text-tertiary hover:text-accent"
        >
          ⋯ 還有 {truncated.hiddenOlderCount} 則更早的留言，去詳情頁看完整對話 →
        </Link>
      )}
      {feedbacks.length > 0 && (
        <ul className="space-y-2">
          {feedbacks.map((fb) => (
            <li key={fb.id}>
              <FeedbackItem feedback={fb} currentUserId={currentUserId} />
            </li>
          ))}
        </ul>
      )}
      {canReply && (
        <ReplyForm progressUpdateId={progressUpdateId} hasExisting={feedbacks.length > 0} />
      )}
    </section>
  )
}

function FeedbackItem({
  feedback,
  currentUserId,
}: {
  feedback: FeedbackThreadItem
  currentUserId: string | null
}) {
  const [editing, setEditing] = useState(false)
  const isMine = currentUserId === feedback.author.id
  const created = new Date(feedback.createdAt)
  const updated = new Date(feedback.updatedAt)
  const edited = updated.getTime() - created.getTime() > 1000

  if (editing && isMine) {
    return <EditForm feedback={feedback} onClose={() => setEditing(false)} />
  }

  return (
    <article
      className={`rounded-r-md border-l-[3px] px-4 py-3 ${
        isMine ? "border-primary bg-primary-subtle" : "border-accent bg-info-subtle"
      }`}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`font-medium ${isMine ? "text-primary" : "text-accent"}`}>
            {feedback.author.name}
          </span>
          <span className="text-text-tertiary">
            {formatDistanceToNow(created, { locale: zhTW, addSuffix: true })}
          </span>
          {edited && (
            <span className="text-text-tertiary">
              （編輯於 {formatDistanceToNow(updated, { locale: zhTW, addSuffix: true })}）
            </span>
          )}
        </div>
        {isMine && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-accent hover:text-accent-hover"
          >
            編輯
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-text-primary">{feedback.content}</p>
    </article>
  )
}

function ReplyForm({
  progressUpdateId,
  hasExisting,
}: {
  progressUpdateId: string
  hasExisting: boolean
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: { content: "" },
  })

  const label = hasExisting ? "+ 回應" : "+ 寫第一則回應"

  if (!expanded) {
    return (
      <div className="border-t border-border-subtle pt-2">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-accent hover:text-accent-hover"
        >
          {label}
        </button>
      </div>
    )
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true)
    setServerError(null)
    const result = await createFeedback(progressUpdateId, data)
    setSubmitting(false)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    form.reset({ content: "" })
    setExpanded(false)
    router.refresh()
  })

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded-r-md border-l-[3px] border-accent bg-info-subtle px-4 py-3"
    >
      <textarea
        rows={3}
        placeholder="留言…"
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
          onClick={() => {
            setExpanded(false)
            setServerError(null)
            form.reset({ content: "" })
          }}
          className="rounded-md border border-border-default bg-surface px-3 py-1.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-text-inverse hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "送出中…" : "送出"}
        </button>
      </div>
    </form>
  )
}

function EditForm({ feedback, onClose }: { feedback: FeedbackThreadItem; onClose: () => void }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: { content: feedback.content },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true)
    setServerError(null)
    const result = await updateFeedback(feedback.id, data)
    setSubmitting(false)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    onClose()
    router.refresh()
  })

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded-r-md border-l-[3px] border-primary bg-primary-subtle px-4 py-3"
    >
      <label htmlFor={`fb-edit-${feedback.id}`} className="block text-xs font-medium text-primary">
        編輯回應
      </label>
      <textarea
        id={`fb-edit-${feedback.id}`}
        rows={3}
        {...form.register("content")}
        className="w-full resize-y rounded-md border border-border-default bg-canvas px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
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
          onClick={onClose}
          className="rounded-md border border-border-default bg-surface px-3 py-1.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "送出中…" : "儲存"}
        </button>
      </div>
    </form>
  )
}
