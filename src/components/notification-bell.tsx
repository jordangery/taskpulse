"use client"

import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import {
  type DueWarning,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationListItem,
} from "@/lib/actions/notifications"

interface NotificationBellProps {
  unreadCount: number
  recent: NotificationListItem[]
  dueWarnings: DueWarning[]
}

export function NotificationBell({ unreadCount, recent, dueWarnings }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [, startTransition] = useTransition()

  // 點外面收起
  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const handleClickItem = (id: string, link: string) => {
    setOpen(false)
    startTransition(async () => {
      await markNotificationRead(id)
      router.push(link)
    })
  }

  const handleClickDueWarning = (link: string, isExternal: boolean) => {
    setOpen(false)
    if (isExternal) {
      // Jira browse URL → 開新分頁，避免 router.push 把外部網址當 next route
      window.open(link, "_blank", "noopener,noreferrer")
    } else {
      router.push(link)
    }
  }

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsRead()
    })
  }

  const totalShown = recent.length + dueWarnings.length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`通知（${unreadCount} 未讀）`}
        className="relative inline-flex items-center rounded-md border border-border-subtle bg-canvas px-2 py-1 text-sm text-text-secondary hover:bg-subtle hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1.5 text-xs font-medium text-text-inverse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-md border border-border-default bg-elevated shadow-md">
          <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
            <span className="text-sm font-medium text-text-primary">通知</span>
            {recent.some((n) => !n.readAt) && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs text-accent hover:text-accent-hover"
              >
                全部標為已讀
              </button>
            )}
          </header>

          {totalShown === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-tertiary">沒有新通知</div>
          ) : (
            <ul className="scrollbar-subtle max-h-96 divide-y divide-border-subtle overflow-y-auto">
              {dueWarnings.map((w) => (
                <li key={`due-${w.source}-${w.taskId}`}>
                  <button
                    type="button"
                    onClick={() => handleClickDueWarning(w.link, w.source === "jira")}
                    className="block w-full px-4 py-3 text-left hover:bg-subtle focus:bg-subtle focus:outline-none"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs ${
                          w.overdue
                            ? "bg-danger-subtle text-danger"
                            : "bg-warning-subtle text-warning"
                        }`}
                      >
                        {w.overdue ? "已逾期" : "快到期"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary">
                          {w.source === "jira" && (
                            <span className="mr-1 font-mono text-xs text-accent">{w.jiraKey}</span>
                          )}
                          {w.source === "jira" ? "" : "任務「"}
                          {w.title}
                          {w.source === "jira" ? "" : "」"}
                          {w.overdue ? " 已過期限" : " 24 小時內到期"}
                        </p>
                        <p className="mt-0.5 text-xs text-text-tertiary">
                          截止 {w.dueDate.toLocaleDateString("zh-TW")}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
              {recent.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClickItem(n.id, n.link)}
                    className={`block w-full px-4 py-3 text-left hover:bg-subtle focus:bg-subtle focus:outline-none ${
                      n.readAt ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.readAt && (
                        <span
                          role="img"
                          aria-label="未讀"
                          className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-accent"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary">{n.message}</p>
                        <p className="mt-0.5 text-xs text-text-tertiary">
                          {formatDistanceToNow(n.createdAt, { locale: zhTW, addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <footer className="border-t border-border-subtle px-4 py-2 text-center">
            <Link
              href="/tasks"
              onClick={() => setOpen(false)}
              className="text-xs text-accent hover:text-accent-hover"
            >
              到任務列表
            </Link>
          </footer>
        </div>
      )}
    </div>
  )
}
