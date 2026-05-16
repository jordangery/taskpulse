"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import type { ProgressActionResult } from "@/lib/actions/progress-updates"
import {
  type ProgressUpdateFormValues,
  progressUpdateFormSchema,
  STATUS_SUGGESTIONS,
} from "@/lib/schemas/progress-update"

const fieldInputClass =
  "w-full rounded-md border border-border-default bg-canvas px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"

const labelClass = "block text-sm font-medium text-text-secondary mb-1"

const FIVE_MIN_MS = 5 * 60 * 1000

interface ProgressUpdateFormProps {
  taskId: string
  action: (taskId: string, input: ProgressUpdateFormValues) => Promise<ProgressActionResult>
  // 最近一筆「由我」在這個任務寫的 update 的時間，用來提醒誤觸連發
  lastMineAt: string | null
}

export function ProgressUpdateForm({ taskId, action, lastMineAt }: ProgressUpdateFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<ProgressUpdateFormValues>({
    resolver: zodResolver(progressUpdateFormSchema),
    defaultValues: { summary: "", percentage: "", status: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    // 5 分鐘內已有「我」寫的 update：給確認框，避免誤觸連發
    if (lastMineAt) {
      const elapsed = Date.now() - new Date(lastMineAt).getTime()
      if (elapsed < FIVE_MIN_MS) {
        const ok = window.confirm(
          `你 ${Math.round(elapsed / 1000 / 60)} 分鐘前才剛寫過進度，確定要再寫一筆嗎？`,
        )
        if (!ok) return
      }
    }

    setSubmitting(true)
    setServerError(null)
    const result = await action(taskId, data)
    setSubmitting(false)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    form.reset({ summary: "", percentage: "", status: "" })
    router.refresh()
  })

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-md border border-border-subtle bg-surface px-5 py-4"
    >
      <h2 className="text-sm font-medium text-text-primary">新增進度</h2>

      <div>
        <label htmlFor="pu-summary" className={labelClass}>
          摘要（5–500 字）
        </label>
        <textarea
          id="pu-summary"
          rows={3}
          placeholder="今天做了什麼、卡在哪、需要協助嗎？"
          {...form.register("summary")}
          className={`${fieldInputClass} resize-y`}
        />
        {form.formState.errors.summary && (
          <p className="mt-1 text-sm text-danger">{form.formState.errors.summary.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pu-percentage" className={labelClass}>
            完成度（選填，0-100）
          </label>
          <input
            id="pu-percentage"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            {...form.register("percentage")}
            className={fieldInputClass}
          />
          {form.formState.errors.percentage && (
            <p className="mt-1 text-sm text-danger">{form.formState.errors.percentage.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="pu-status" className={labelClass}>
            狀態（選填）
          </label>
          <input
            id="pu-status"
            type="text"
            list="status-suggestions"
            placeholder="進行中、卡住…"
            {...form.register("status")}
            className={fieldInputClass}
          />
          <datalist id="status-suggestions">
            {STATUS_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {form.formState.errors.status && (
            <p className="mt-1 text-sm text-danger">{form.formState.errors.status.message}</p>
          )}
        </div>
      </div>

      {serverError && (
        <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
          {serverError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "送出中…" : "送出進度"}
        </button>
      </div>
    </form>
  )
}
