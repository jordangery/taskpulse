"use client"

// 全站頂部 progress bar：點任何內部連結 → 馬上一條 4px 高的霓虹漸層
// 條子在頂部跑（Material 雙波段動畫 + accent/info 漸層 + 光暈），
// 路徑變了 → 自動消失（pathname 改變 = 導航完成）。
//
// 為什麼用 click 事件捕捉而不是只看 pathname：pathname 只在「導航完成後」
// 才更新，捕捉不到「按下到完成」的中間瞬間 — 那才是用戶覺得頁面卡住的時候。

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export function RouteProgress() {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest?.("a")
      if (!(link instanceof HTMLAnchorElement)) return
      // 過濾：新分頁 / 下載 / 修飾鍵 / 右鍵中鍵 / 外部站 / 同路徑
      if (link.target === "_blank") return
      if (link.hasAttribute("download")) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      try {
        const url = new URL(link.href)
        if (url.origin !== window.location.origin) return
        if (url.pathname === window.location.pathname) return
      } catch {
        return
      }
      setPending(true)
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  // pathname 變了 → 視為導航完成
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname 是觸發子；不在 body 讀但變化要重跑
  useEffect(() => {
    setPending(false)
  }, [pathname])

  // safety net：避免某些 edge case（伺服器 action / 異常）讓 bar 卡住一直顯示
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setPending(false), 10_000)
    return () => clearTimeout(t)
  }, [pending])

  if (!pending) return null

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-1 overflow-hidden"
        style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
      >
        {/* 雙波段：兩條 bar 用不同 timing function 交替橫掃，視覺上是連續波浪 */}
        <span
          className="route-progress-bar-1 absolute inset-y-0"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--accent), var(--info, var(--accent)), var(--accent))",
            boxShadow:
              "0 0 8px var(--accent), 0 0 18px var(--accent), 0 0 28px color-mix(in srgb, var(--info, var(--accent)) 60%, transparent)",
          }}
        />
        <span
          className="route-progress-bar-2 absolute inset-y-0"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--info, var(--accent)), var(--accent), transparent)",
            boxShadow:
              "0 0 6px var(--accent), 0 0 14px color-mix(in srgb, var(--accent) 80%, transparent)",
          }}
        />
      </div>
      <style>{`
        @keyframes route-progress-1 {
          0% { left: -35%; right: 100%; }
          60%, 100% { left: 100%; right: -90%; }
        }
        @keyframes route-progress-2 {
          0%, 60% { left: -200%; right: 100%; }
          100% { left: 107%; right: -8%; }
        }
        .route-progress-bar-1 {
          animation: route-progress-1 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
        }
        .route-progress-bar-2 {
          animation: route-progress-2 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) infinite;
          animation-delay: 1.15s;
        }
      `}</style>
    </>
  )
}
