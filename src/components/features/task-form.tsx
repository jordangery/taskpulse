"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
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
  // 用在 modal：成功後不導頁，只 reset + 呼叫 onSuccess（讓父層關 modal）
  onSuccess?: (result: { id: string }) => void
}

export function TaskForm({
  mode,
  action,
  assignees,
  defaultValues,
  onSuccessRedirect,
  onSuccess,
}: TaskFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: defaultValues ?? {
      title: "",
      description: "",
      assigneeIds: [],
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
    if (onSuccess) {
      form.reset()
      onSuccess(result.data)
      router.refresh()
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
          rows={3}
          {...form.register("description")}
          className={`${fieldInputClass} resize-y`}
        />
        {form.formState.errors.description && (
          <p className="mt-1 text-sm text-danger">{form.formState.errors.description.message}</p>
        )}
      </div>

      <div>
        <p className={labelClass}>
          指派給（可複選；第一位為 primary，會當作 Jira 同步時的 assignee）
        </p>
        <Controller
          control={form.control}
          name="assigneeIds"
          render={({ field }) => (
            <AssigneePicker all={assignees} value={field.value ?? []} onChange={field.onChange} />
          )}
        />
        {form.formState.errors.assigneeIds && (
          <p className="mt-1 text-sm text-danger">{form.formState.errors.assigneeIds.message}</p>
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
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "送出中…" : mode === "create" ? "新增任務" : "儲存"}
        </button>
        {!onSuccess && (
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-border-default bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-subtle hover:text-text-primary"
          >
            取消
          </button>
        )}
      </div>
    </form>
  )
}

// 多選 assignee picker：點 chip 加入 / 移除；保留點擊順序（第一個 = primary）
function AssigneePicker({
  all,
  value,
  onChange,
}: {
  all: Assignee[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }
  const selectedSet = new Set(value)
  // 排序：選中的（依 value 內順序）放前面，未選的依 admin/name 排
  const selectedFirst = [
    ...value.map((id) => all.find((u) => u.id === id)).filter((u): u is Assignee => Boolean(u)),
    ...all.filter((u) => !selectedSet.has(u.id)),
  ]
  return (
    <div className="rounded-md border border-border-default bg-canvas p-2">
      {value.length > 0 && (
        <p className="mb-2 text-xs text-text-tertiary">
          已選 {value.length} 位（第一位 = primary）
        </p>
      )}
      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto scrollbar-subtle">
        {selectedFirst.map((u, idx) => {
          const selected = selectedSet.has(u.id)
          const isPrimary = selected && value[0] === u.id
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle(u.id)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                selected
                  ? isPrimary
                    ? "bg-primary text-primary-text"
                    : "bg-accent-subtle text-accent"
                  : "bg-subtle text-text-secondary hover:bg-canvas hover:text-text-primary"
              }`}
            >
              {selected && (
                <span className="mr-1 text-[10px]">{isPrimary ? "★" : `${idx + 1}`}</span>
              )}
              {u.name}
              {u.role === "admin" && <span className="ml-1 text-[10px] opacity-70">(主管)</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
