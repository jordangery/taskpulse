// Jira status 的 bucket 分類（共享給 issue list / team summary 用）
//
// match 用 keyword：英文（Jira 預設）+ 繁簡中文都列（內部 Jira workflow 常用中文 status name）
// match 優先順序：已完成 → review → 進行中 → 開放 → 其他
//   (已完成放第一是為了避免「已修復」被「修復中」regex 搶走)
// 顯示順序：開放 → 進行中 → review → 已完成 → 其他（DISPLAY_ORDER）
//
// cls 是 unselected 樣式（subtle 底色 + 對應文字色）、activeCls 給 filter chip 選中時用

export type BucketId = "open" | "in_progress" | "review" | "done" | "other"

export interface BucketDef {
  id: BucketId
  label: string
  match: RegExp | null
  cls: string
  activeCls: string
}

export const BUCKETS: ReadonlyArray<BucketDef> = [
  {
    id: "done",
    label: "已完成",
    match: /done|closed|resolved|complete|已修復|已完成|已關閉|已解決|已结案|完成|结案|关闭|完了/i,
    cls: "bg-success-subtle text-success",
    activeCls: "bg-success text-text-inverse",
  },
  {
    id: "review",
    label: "Review",
    match: /review|qa|verify|待審|待測|審查|审查|待验|驗證|验证|待確認/i,
    cls: "bg-info-subtle text-info",
    activeCls: "bg-info text-text-inverse",
  },
  {
    id: "in_progress",
    label: "進行中",
    match: /progress|doing|develop|進行中|进行中|開發中|开发中|處理中|处理中|修復中|修复中/i,
    cls: "bg-accent-subtle text-accent",
    activeCls: "bg-accent text-text-inverse",
  },
  {
    id: "open",
    label: "開放",
    match: /todo|open|backlog|to do|new|selected|開放|开放|待辦|待办|待處理|待处理|新增|未指派/i,
    cls: "bg-warning-subtle text-warning",
    activeCls: "bg-warning text-text-inverse",
  },
  {
    id: "other",
    label: "其他",
    match: null,
    cls: "bg-subtle text-text-secondary",
    activeCls: "bg-text-tertiary text-text-inverse",
  },
]

export const DISPLAY_ORDER: BucketId[] = ["open", "in_progress", "review", "done", "other"]

export function bucketIdFor(status: string): BucketId {
  const lower = status.toLowerCase()
  for (const b of BUCKETS) {
    if (b.match?.test(lower)) return b.id
  }
  return "other"
}

export function bucketDefFor(status: string): BucketDef {
  const id = bucketIdFor(status)
  return BUCKETS.find((x) => x.id === id) ?? BUCKETS[BUCKETS.length - 1]
}
