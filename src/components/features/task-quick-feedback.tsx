"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { createInitialAdminFeedback } from "@/lib/actions/feedbacks"
import { type FeedbackFormValues, feedbackFormSchema } from "@/lib/schemas/feedback"

interface Props {
  taskId: string
  isAdmin: boolean
}

// 給「還沒任何進度」的任務 admin 用的「快速回饋」 UI
// 點下展開 inline form → 送出時 server action 建一筆 admin 自己的 placeholder ProgressUpdate
// 加上 Feedback 一起，1對1 保住
export function TaskQuickFeedback({ taskId, isAdmin }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: { content: "" },
  })

  if (!isAdmin) return null

  if (!editing) {
    return (
      <div className="mt-3 border-t border-border-subtle pt-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-accent hover:text-accent-hover"
        >
          + 快速回饋（不用等組員寫進度）
        </button>
      </div>
    )
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true)
    setServerError(null)
    const result = await createInitialAdminFeedback(taskId, data)
    setSubmitting(false)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    form.reset({ content: "" })
    setEditing(false)
    router.refresh()
  })

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 space-y-2 rounded-r-md border-l-[3px] border-accent bg-info-subtle px-4 py-3"
    >
      <label htmlFor={`quick-fb-${taskId}`} className="block text-xs font-medium text-accent">
        快速回饋
      </label>
      <p className="text-xs text-text-tertiary">
        會自動建一筆「主管快速回饋此任務」的進度紀錄並附上你的回饋
      </p>
      <textarea
        id={`quick-fb-${taskId}`}
        rows={3}
        placeholder="想對這個任務說的話…"
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
            setEditing(false)
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
          {submitting ? "送出中…" : "送出快速回饋"}
        </button>
      </div>
    </form>
  )
}
