"use client"

import { useTheme } from "./theme-provider"

const ICONS = {
  system: "🖥",
  light: "☀",
  dark: "☾",
} as const

const LABELS = {
  system: "跟隨系統",
  light: "日間",
  dark: "夜間",
} as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycle = () => {
    const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system"
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`目前：${LABELS[theme]}，點擊切換`}
      title={`目前：${LABELS[theme]}`}
      className="
        inline-flex items-center gap-2 px-3 py-1.5 rounded-md
        text-sm text-text-secondary
        border border-border-subtle bg-surface
        hover:bg-subtle hover:text-text-primary hover:border-border-default
        focus:outline-none focus:ring-2 focus:ring-accent
        transition-colors
      "
    >
      <span className="text-base leading-none" aria-hidden>
        {ICONS[theme]}
      </span>
      <span>{LABELS[theme]}</span>
    </button>
  )
}
