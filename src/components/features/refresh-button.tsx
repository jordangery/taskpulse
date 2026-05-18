"use client"

// 通用 refresh button —— server action revalidatePath + 至少 300ms 可見 pending 狀態
//
// 之前用 router.refresh() 但它是 fire-and-forget，pending 立刻 false，使用者看不到反應；
// 改成 await server action 後 Next.js 會等 RSC 重撈完才 resolve，pending 期間 disable + 顯示「撈取中…」

import { useTransition } from "react"
import { revalidateDashboard } from "@/lib/actions/refresh"

interface Props {
  title?: string
  className?: string
}

const MIN_VISIBLE_MS = 300

export function RefreshButton({ title = "重新撈取", className }: Props) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const startedAt = Date.now()
          await revalidateDashboard()
          // 保證至少 300ms pending 狀態，讓使用者看得到「撈取中…」回饋
          const elapsed = Date.now() - startedAt
          if (elapsed < MIN_VISIBLE_MS) {
            await new Promise((r) => setTimeout(r, MIN_VISIBLE_MS - elapsed))
          }
        })
      }
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
