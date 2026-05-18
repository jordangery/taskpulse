"use client"

import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Suspense, useState } from "react"

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
  const [pending, setPending] = useState(false)

  async function handleGoogle() {
    setPending(true)
    try {
      await signIn("google", { callbackUrl, redirectTo: callbackUrl })
    } finally {
      setPending(false)
    }
  }

  return (
    <LoginShell>
      <h1 className="text-2xl font-semibold text-text-primary">登入 Taskpulse</h1>
      <p className="mt-1 text-sm text-text-secondary">用 Google 帳號登入</p>

      {error && (
        <div className="mt-4 rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
          登入失敗：{error}
        </div>
      )}

      <section className="mt-6 space-y-3">
        <button
          type="button"
          disabled={pending}
          onClick={handleGoogle}
          className="w-full rounded-md border border-border-default bg-canvas px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "前往 Google…" : "使用 Google 登入"}
        </button>
      </section>
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
