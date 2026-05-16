"use client"

import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Suspense, useState } from "react"

const TEST_USERS = [
  { email: "jordan@geryon.net", name: "Jordan", role: "admin" as const },
  { email: "alice@taskpulse.dev", name: "Alice", role: "member" as const },
  { email: "bob@taskpulse.dev", name: "Bob", role: "member" as const },
  { email: "carol@taskpulse.dev", name: "Carol", role: "member" as const },
]

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoginShell>
          <div />
        </LoginShell>
      }
    >
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const params = useSearchParams()
  const callbackUrl = params.get("callbackUrl") ?? "/"
  const error = params.get("error")
  const [pending, setPending] = useState<string | null>(null)

  // Dev-only：production build NODE_ENV=production，這段 array 為空
  const showDevOptions = process.env.NODE_ENV !== "production"

  async function handle(provider: string, email?: string) {
    const tag = email ?? provider
    setPending(tag)
    try {
      await signIn(provider, {
        callbackUrl,
        ...(email ? { email } : {}),
        redirectTo: callbackUrl,
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <LoginShell>
      <h1 className="text-2xl font-semibold text-text-primary">登入 Taskpulse</h1>
      <p className="mt-1 text-sm text-text-secondary">挑一個身分繼續</p>

      {error && (
        <div className="mt-4 rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
          登入失敗：{error}
        </div>
      )}

      <section className="mt-6 space-y-3">
        <button
          type="button"
          disabled={!!pending}
          onClick={() => handle("google")}
          className="w-full rounded-md border border-border-default bg-canvas px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === "google" ? "前往 Google…" : "使用 Google 登入"}
        </button>
      </section>

      {showDevOptions && (
        <section className="mt-6 border-t border-border-subtle pt-4">
          <h2 className="mb-1 text-xs uppercase tracking-wide text-text-tertiary">
            測試帳號（dev only）
          </h2>
          <p className="mb-3 text-xs text-text-tertiary">
            production build 不會出現這區、無需擔心線上洩漏
          </p>
          <ul className="space-y-2">
            {TEST_USERS.map((u) => (
              <li key={u.email}>
                <button
                  type="button"
                  disabled={!!pending}
                  onClick={() => handle("dev-impersonate", u.email)}
                  className="flex w-full items-center justify-between rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm hover:border-border-default hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{u.name}</span>
                    <span className="text-xs text-text-tertiary">{u.email}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      u.role === "admin"
                        ? "bg-primary-subtle text-primary"
                        : "bg-accent-subtle text-accent"
                    }`}
                  >
                    {u.role === "admin" ? "主管" : "組員"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pending && pending !== "google" && (
            <p className="mt-3 text-xs text-text-tertiary">登入中…{pending}</p>
          )}
        </section>
      )}
    </LoginShell>
  )
}

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-md border border-border-subtle bg-surface px-6 py-8">
        {children}
      </div>
    </div>
  )
}
