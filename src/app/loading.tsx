// 全站預設 loading suspense fallback
// 任何 server component 在 fetch 都會由 Next.js 自動用這個取代頁面內容
// 三層脈衝點 + accent 霓虹光暈 + 等寬大字 "LOADING"

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="flex flex-col items-center gap-6">
        {/* 三層脈衝：外層擴散 ring、中層淡入淡出、核心發光 */}
        <div className="relative h-24 w-24">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background: "var(--accent)",
              opacity: 0.18,
              animation: "loading-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-3 rounded-full"
            style={{
              background: "var(--accent)",
              opacity: 0.4,
              animation: "loading-pulse 1.8s ease-in-out infinite",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-7 rounded-full"
            style={{
              background: "var(--accent)",
              boxShadow:
                "0 0 16px var(--accent), 0 0 32px var(--accent), 0 0 48px color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
        </div>

        {/* 文字 + 跳動小點 */}
        <div className="flex items-baseline gap-2">
          <p
            className="font-mono text-xs uppercase tracking-[0.5em] text-text-secondary"
            style={{
              textShadow: "0 0 12px color-mix(in srgb, var(--accent) 60%, transparent)",
            }}
          >
            Loading
          </p>
          <span className="loading-dots flex gap-1" aria-hidden>
            <span
              className="loading-dot inline-block h-1 w-1 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            <span
              className="loading-dot inline-block h-1 w-1 rounded-full"
              style={{ background: "var(--accent)", animationDelay: "0.2s" }}
            />
            <span
              className="loading-dot inline-block h-1 w-1 rounded-full"
              style={{ background: "var(--accent)", animationDelay: "0.4s" }}
            />
          </span>
        </div>
      </div>

      <style>{`
        @keyframes loading-ping {
          0% { transform: scale(0.7); opacity: 0.5; }
          75%, 100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes loading-pulse {
          0%, 100% { transform: scale(0.85); opacity: 0.3; }
          50% { transform: scale(1.05); opacity: 0.7; }
        }
        @keyframes loading-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1.4); opacity: 1; }
        }
        .loading-dot {
          animation: loading-dot 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
