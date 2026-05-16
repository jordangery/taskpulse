"use client"

import { useState } from "react"

interface CopyButtonProps {
  text: string
  label?: string
  copiedLabel?: string
  className?: string
}

export function CopyButton({
  text,
  label = "複製為純文字",
  copiedLabel = "已複製 ✓",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setError(null)
      window.setTimeout(() => setCopied(false), 1500)
    } catch (_e) {
      setError("無法複製，請手動選取")
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        className={
          className ??
          "rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-subtle hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        }
      >
        {copied ? copiedLabel : label}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
