"use client"

// /tasks 上「新增任務」按鈕的彈窗版本
// 用原生 <dialog> + showModal()，不引入額外套件
//
// 流程：
//   父層（server）撈 assignees 傳進來
//   admin 點按鈕 → showModal → 表單送出後 onSuccess 關 modal + router.refresh()
//   失敗：TaskForm 自己顯示 server error，不關 modal

import { useEffect, useRef } from "react"
import { createTask } from "@/lib/actions/tasks"
import { TaskForm } from "./task-form"

interface Assignee {
  id: string
  name: string
  role: "admin" | "member"
}

interface Props {
  assignees: Assignee[]
}

export function TaskCreateModal({ assignees }: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  // ESC 關閉時清除 backdrop blur effect
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    const onClose = () => {
      // 沒事，但保留 hook 給之後加 cleanup
    }
    d.addEventListener("close", onClose)
    return () => {
      d.removeEventListener("close", onClose)
    }
  }, [])

  const open = () => dialogRef.current?.showModal()
  const close = () => dialogRef.current?.close()

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent"
      >
        新增任務
      </button>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: dialog 原生 Esc 已關閉，backdrop click 是滑鼠專屬便利功能不需 key event */}
      <dialog
        ref={dialogRef}
        // 原生 <dialog> 在 Tailwind preflight 下會被吃 margin、瀏覽器 default centering 失效
        // 改用 fixed + inset-0 + m-auto + h-fit 手動置中，背景明確指定 bg-surface + text token
        // shadow-xl 讓視覺浮起來、跟背景區隔
        // backdrop:bg-text-primary/50 比 0.4 opacity 更顯眼，跟主題色保持一致
        className="fixed inset-0 m-auto h-fit max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-border-default bg-surface p-0 text-text-primary shadow-xl backdrop:bg-text-primary/50 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          // 點 backdrop（dialog 本體之外）關閉
          if (e.target === dialogRef.current) close()
        }}
      >
        <div className="px-6 py-5">
          <header className="mb-4 flex items-center justify-between border-b border-border-subtle pb-3">
            <h2 className="text-lg font-semibold text-text-primary">新增任務</h2>
            <button
              type="button"
              onClick={close}
              aria-label="關閉"
              className="rounded-md px-2 py-0.5 text-base text-text-tertiary hover:bg-subtle hover:text-text-primary"
            >
              ✕
            </button>
          </header>
          <TaskForm
            mode="create"
            action={createTask}
            assignees={assignees}
            onSuccess={() => close()}
          />
        </div>
      </dialog>
    </>
  )
}
