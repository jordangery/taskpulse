"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import type { ActionResult } from "@/lib/actions/members"
import {
  type CreateMemberInput,
  createMemberSchema,
  type UpdateMemberInput,
  updateMemberSchema,
} from "@/lib/schemas/user"

const fieldInputClass =
  "w-full rounded-md border border-border-default bg-canvas px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"

const labelClass = "block text-sm font-medium text-text-secondary mb-1"

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-sm text-danger">{message}</p>
}

function ServerError({ message }: { message: string | null }) {
  if (!message) return null
  return <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">{message}</div>
}

interface CreateProps {
  mode: "create"
  action: (input: CreateMemberInput) => Promise<ActionResult>
}

interface EditProps {
  mode: "edit"
  action: (input: UpdateMemberInput) => Promise<ActionResult>
  defaultValues: UpdateMemberInput
  email: string // 顯示用，不可編輯
}

export function MemberForm(props: CreateProps | EditProps) {
  if (props.mode === "create") return <CreateForm {...props} />
  return <EditForm {...props} />
}

function CreateForm({ action }: CreateProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CreateMemberInput>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: { name: "", email: "", role: "member" },
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
    router.push("/members")
    router.refresh()
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className={labelClass}>
          姓名
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          {...form.register("name")}
          className={fieldInputClass}
        />
        <FieldError message={form.formState.errors.name?.message} />
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...form.register("email")}
          className={fieldInputClass}
        />
        <FieldError message={form.formState.errors.email?.message} />
      </div>

      <RoleField register={form.register("role")} error={form.formState.errors.role?.message} />

      <ServerError message={serverError} />

      <FormActions submitting={submitting} submitLabel="新增成員" />
    </form>
  )
}

function EditForm({ action, defaultValues, email }: EditProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<UpdateMemberInput>({
    resolver: zodResolver(updateMemberSchema),
    defaultValues,
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
    router.push("/members")
    router.refresh()
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className={labelClass}>
          姓名
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          {...form.register("name")}
          className={fieldInputClass}
        />
        <FieldError message={form.formState.errors.name?.message} />
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Email（不可編輯）
        </label>
        <input
          id="email"
          type="email"
          value={email}
          readOnly
          disabled
          className={`${fieldInputClass} cursor-not-allowed text-text-tertiary`}
        />
      </div>

      <RoleField register={form.register("role")} error={form.formState.errors.role?.message} />

      <ServerError message={serverError} />

      <FormActions submitting={submitting} submitLabel="儲存" />
    </form>
  )
}

function RoleField({
  register,
  error,
}: {
  register: ReturnType<ReturnType<typeof useForm>["register"]>
  error?: string
}) {
  return (
    <div>
      <label htmlFor="role" className={labelClass}>
        角色
      </label>
      <select id="role" {...register} className={fieldInputClass}>
        <option value="member">member（組員）</option>
        <option value="admin">admin（主管）</option>
      </select>
      <FieldError message={error} />
    </div>
  )
}

function FormActions({ submitting, submitLabel }: { submitting: boolean; submitLabel: string }) {
  const router = useRouter()
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "送出中…" : submitLabel}
      </button>
      <button
        type="button"
        onClick={() => router.back()}
        className="rounded-md border border-border-default bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-subtle hover:text-text-primary"
      >
        取消
      </button>
    </div>
  )
}
