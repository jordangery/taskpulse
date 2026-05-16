"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import type { TaskActionResult } from "@/lib/actions/tasks"
import { type TaskFormValues, taskFormSchema } from "@/lib/schemas/task"

const fieldInputClass =
  "w-full rounded-md border border-border-default bg-canvas px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"

const labelClass = "block text-sm font-medium text-text-secondary mb-1"

interface Assignee {
  id: string
  name: string
  role: "admin" | "member"
}

interface TaskFormProps {
  mode: "create" | "edit"
  action: (input: TaskFormValues) => Promise<TaskActionResult>
  assignees: Assignee[]
  defaultValues?: TaskFormValues
  onSuccessRedirect?: string
}

export function TaskForm({
  mode,
  action,
  assignees,
  defaultValues,
  onSuccessRedirect,
}: TaskFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: defaultValues ?? {
      title: "",
      description: "",
      assigneeId: assignees[0]?.id ?? "",
      dueDate: "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true)
    setServerError(null)
    const result = await action(data)
    setSubmitting(false)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    router.push(onSuccessRedirect ?? `/tasks/${result.data.id}`)
    router.refresh()
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className={labelClass}>
          標題
        </label>
        <input id="title" type="text" {...form.register("title")} className={fieldInputClass} />
        {form.formState.errors.title && (
          <p className="mt-1 text-sm text-danger">{form.formState.errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          描述（選填）
        </label>
        <textarea
          id="description"
          rows={4}
          {...form.register("description")}
          className={`${fieldInputClass} resize-y`}
        />
        {form.formState.errors.description && (
          <p className="mt-1 text-sm text-danger">{form.formState.errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="assigneeId" className={labelClass}>
          指派給
        </label>
        <select id="assigneeId" {...form.register("assigneeId")} className={fieldInputClass}>
          {assignees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}（{u.role === "admin" ? "主管" : "組員"}）
            </option>
          ))}
        </select>
        {form.formState.errors.assigneeId && (
          <p className="mt-1 text-sm text-danger">{form.formState.errors.assigneeId.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="dueDate" className={labelClass}>
          截止日（選填）
        </label>
        <input id="dueDate" type="date" {...form.register("dueDate")} className={fieldInputClass} />
        {form.formState.errors.dueDate && (
          <p className="mt-1 text-sm text-danger">{form.formState.errors.dueDate.message}</p>
        )}
      </div>

      {serverError && (
        <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
          {serverError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "送出中…" : mode === "create" ? "新增任務" : "儲存"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border-default bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-subtle hover:text-text-primary"
        >
          取消
        </button>
      </div>
    </form>
  )
}
