"use client"

// 通用 refresh button —— 觸發 router.refresh() 重跑 server component
// dashboard Jira widget 用，避免使用者得 F5 整頁
// 撈取中會 disable + 換 spinner 文字（純 emoji，不引入 icon 套件）

import { useRouter } from "next/navigation"
import { useTransition } from "react"

interface Props {
  title?: string
  className?: string
}

export function RefreshButton({ title = "重新撈取", className }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      title={title}
      aria-label={title}
      className={`rounded-md border border-border-subtle bg-canvas px-2 py-0.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary disabled:opacity-50 ${
        className ?? ""
      }`}
    >
      {pending ? "撈取中…" : "↻"}
    </button>
  )
}
