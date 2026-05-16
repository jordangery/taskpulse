import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
        <span className="text-sm font-medium text-text-secondary">Taskpulse</span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-12">
        <div className="space-y-3 text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-text-primary">Taskpulse</h1>
          <p className="mx-auto max-w-md text-base text-text-secondary">
            團隊任務追蹤｜append-only 進度摘要 ＋ 1 對 1 主管回饋
          </p>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border-subtle bg-surface px-4 py-3 text-center">
            <div className="mb-1 text-xs uppercase tracking-wide text-text-tertiary">底色</div>
            <div className="text-sm text-text-primary">暖米紙 / 深藍灰</div>
          </div>
          <div className="rounded-md border border-border-subtle bg-primary-subtle px-4 py-3 text-center">
            <div className="mb-1 text-xs uppercase tracking-wide text-text-tertiary">主色</div>
            <div className="text-sm text-text-primary">暖橄欖綠</div>
          </div>
          <div className="rounded-md border border-border-subtle bg-accent-subtle px-4 py-3 text-center">
            <div className="mb-1 text-xs uppercase tracking-wide text-text-tertiary">輔色</div>
            <div className="text-sm text-text-primary">靛藍</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="rounded-full bg-success-subtle px-3 py-1 text-success">完成</span>
          <span className="rounded-full bg-info-subtle px-3 py-1 text-info">進行中</span>
          <span className="rounded-full bg-warning-subtle px-3 py-1 text-warning">卡住</span>
          <span className="rounded-full bg-danger-subtle px-3 py-1 text-danger">逾期</span>
        </div>

        <p className="text-xs text-text-tertiary">
          Step 2 主題驗證頁 — Day 1 Step 8 會替換為 Dashboard
        </p>
      </main>
    </div>
  )
}
