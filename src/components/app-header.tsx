"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { useState } from "react"
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
        {user && (
          // 未登入時不顯示 nav，避免在 /login 上看到點了就 loop 回 /login 的死連結
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/tasks" className="text-text-secondary hover:text-text-primary">
              任務
            </Link>
            {user.role === "admin" && (
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
        )}
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="text-xs text-text-tertiary">
              {user.name}（{user.role === "admin" ? "主管" : "組員"}）
            </span>
            <SignOutButton />
          </>
        ) : (
          <span className="text-xs text-warning">未設定身分</span>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}

function SignOutButton() {
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        // signOut 預設會把 cookie 清掉、redirect 到 callbackUrl
        // callbackUrl 指 /api/auth/signin 讓使用者馬上換 user
        await signOut({ callbackUrl: "/api/auth/signin" })
      }}
      className="rounded-md border border-border-subtle bg-canvas px-2 py-1 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "登出中…" : "登出"}
    </button>
  )
}
