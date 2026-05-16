"use client"

import Link from "next/link"
import { ThemeToggle } from "./theme-toggle"

interface AppHeaderProps {
  user: { name: string; role: "admin" | "member" } | null
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border-subtle bg-surface px-6 py-3">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="text-sm font-semibold text-text-primary hover:text-text-secondary"
        >
          Taskpulse
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/tasks" className="text-text-secondary hover:text-text-primary">
            任務
          </Link>
          {user?.role === "admin" && (
            <>
              <Link href="/members" className="text-text-secondary hover:text-text-primary">
                成員
              </Link>
              <Link href="/reports" className="text-text-secondary hover:text-text-primary">
                回報
              </Link>
            </>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <span className="text-xs text-text-tertiary">
            {user.name}（{user.role === "admin" ? "主管" : "組員"}）
          </span>
        ) : (
          <span className="text-xs text-warning">未設定身分</span>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
