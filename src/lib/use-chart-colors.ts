"use client"

import { useEffect, useState } from "react"

const CSS_VARS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"] as const

export type ChartColors = readonly [string, string, string, string, string]

// 讀 globals.css 的 --chart-1..5；data-theme 或 prefers-color-scheme 變動會重新抓
// 避免在 Recharts 寫死 hex（design-system.md 第 290 行）
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(["", "", "", "", ""])

  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement)
      const next = CSS_VARS.map((v) => style.getPropertyValue(v).trim()) as unknown as ChartColors
      setColors(next)
    }
    read()

    // 監聽 data-theme attribute 改變（ThemeToggle 手動切換）
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })

    // 監聽系統主題（跟隨系統時生效）
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    mq.addEventListener("change", read)

    return () => {
      obs.disconnect()
      mq.removeEventListener("change", read)
    }
  }, [])

  return colors
}
