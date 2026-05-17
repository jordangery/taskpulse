# Calendar Widget on Dashboard — Phase B Design

- **Status**: Approved 2026-05-17
- **Phase**: B of 7（見最後「Roadmap」段，本 spec 只實作 B 本體）
- **Owner**: Jordan
- **Depends on**: 既有 Task.dueDate 欄位、dashboard-admin / dashboard-member 結構

---

## Problem

使用者要把 taskpulse 拿來實際當團隊任務追蹤工具用。目前 dashboard 看不出「接下來幾天會發生什麼事」— 任務列表能看到 dueDate 但散在各張卡片裡、沒有時間軸視角。

## Goals

- 在 dashboard 加一個 calendar widget，**4 週視野**：過去 1 週 + 本週 + 未來 2 週 = 28 天
- Admin 看全隊任務的 dueDate；member 看自己被指派的
- 每格顯示該日到期的任務數量
- 「今天」高亮、逾期未完成的日子用 warning 色標示
- Hover 顯示該日任務名稱（最多 5 個）
- 沒設 dueDate 的任務不顯示（widget 是 dueDate-driven）

## Non-goals (本 phase 不做、留給後續 phase)

- ❌ 點格子跳該天詳細頁（Phase C）
- ❌ 拖任務改 dueDate（Phase F）
- ❌ 月 / 週 view 切換（固定 4 週、Phase G 才加切換）
- ❌ 國定假日標示（Phase E）
- ❌ 已完成狀態 dim / checkmark（Phase A 加入 Task.completedAt 後再回頭 enhance widget）

## Architecture

### 位置

- `src/components/features/dashboard-calendar.tsx`（新檔，**server component** — 不需 client state；hover tooltip 用 CSS `group-hover` 純 SSR 即可）
- 接收 props：`{ events: CalendarEvent[]; todayKey: string }`
- 從 `src/components/features/dashboard-admin.tsx` 跟 `src/components/features/dashboard-member.tsx` 兩邊都 render
- 放在每個 dashboard 的**最上方**（高注意力資訊優先）

### 日期範圍（**對齊週 Mon-Sun**）

避免「過去 1 週 + 本週 + 未來 2 週」對應到 22 天的尷尬數字 → 改用週對齊：

- 找 today 所在週的週一（startOfISOWeek）
- start = 該週一 - 1 週 = 過去那一週的週一
- end = start + 28 天 (4 週 = 4 個 Mon-Sun)
- → 28 格剛好 4 行、視覺乾淨、人類心智「這週」「上週」「下週」對齊

舉例：today = 2026-05-17（週日），week start (Mon) = 2026-05-11，calendar range = 2026-05-04 ~ 2026-05-31。

### 資料抓取

新檔 `src/lib/calendar.ts`：

```ts
import { addDays, startOfDay, startOfWeek } from "date-fns"

export interface CalendarTask {
  id: string
  title: string
  assigneeName: string
  overdue: boolean // dueDate < today (嚴格小於)
}

export interface CalendarEvent {
  date: string // "YYYY-MM-DD" (local time)
  tasks: CalendarTask[]
}

export async function fetchCalendarEvents(
  userId: string,
  isAdmin: boolean,
): Promise<{ events: CalendarEvent[]; todayKey: string; startKey: string }> {
  const today = startOfDay(new Date())
  // weekStartsOn: 1 = Monday
  const thisWeekMonday = startOfWeek(today, { weekStartsOn: 1 })
  const start = addDays(thisWeekMonday, -7) // 上週週一
  const end = addDays(start, 28) // 28 天後 exclusive

  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
      dueDate: { gte: start, lt: end, not: null },
      ...(isAdmin ? {} : { assigneeId: userId }),
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assignee: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
  })

  // 28 個 bucket、key = YYYY-MM-DD（local time）
  const buckets = new Map<string, CalendarTask[]>()
  for (let i = 0; i < 28; i++) {
    const d = addDays(start, i)
    buckets.set(toLocalKey(d), [])
  }
  for (const t of tasks) {
    if (!t.dueDate) continue
    const key = toLocalKey(t.dueDate)
    const slot = buckets.get(key)
    if (!slot) continue
    slot.push({
      id: t.id,
      title: t.title,
      assigneeName: t.assignee.name,
      overdue: t.dueDate < today,
    })
  }
  return {
    events: Array.from(buckets.entries()).map(([date, tasks]) => ({ date, tasks })),
    todayKey: toLocalKey(today),
    startKey: toLocalKey(start),
  }
}

function toLocalKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
```

### 渲染（28 cell grid）

- Grid: `grid-cols-7`、4 rows、`gap-1`
- Cell size: `h-16` 桌面、`h-12` 平板、stack vertically on mobile (`< sm`)
- 各 cell 內：
  - 上方：日期數字 + 月份（每月第一格才顯月份）
  - 下方：count badge（圓點 + 數字、最多 3 個圓點之後變「+N」）
- 顏色 token（design-system.md tokens）：
  - 預設 background: `bg-canvas`
  - 今天: `bg-accent-subtle text-accent` + ⭐ icon
  - 逾期日（過去 + 該日有 task 且 task 仍 active）: `bg-danger-subtle text-danger`
  - 一般過去日（沒任務或任務都完成、本 phase 無法判斷完成）: `text-text-tertiary opacity-60`
  - 一般未來日: `text-text-secondary`

### Hover Tooltip

- Hover cell（has tasks）→ 浮現 tooltip 列任務名稱
- Tooltip 內容：最多 5 個 task title + 第 6 個以後「等 N 個」
- 實作：簡單版用 `<div>` + Tailwind `group-hover:` 即可、無需第三方 lib
- 行動裝置：tap → toggle tooltip（focus state 開合）

### 月份標頭

當 cell 是該月第 1 天時，cell 上方多渲染月份標籤（例如「5 月」）。Layout 上不破壞 grid（用 cell 內 `before:` 偽元素或 cell 內第一行小字）。

## Edge Cases

- **4 週都沒任何 dueDate** → widget 仍顯但 28 格全空 / 灰；widget 下方加提示「沒任何任務設了截止日 — 去 [任務頁](/tasks) 設一下才會出現在這」
- **單格塞超多任務** → cell 顯數字「9」+ 圓點截斷至 3 個；tooltip 列前 5 個 + 「等 4 個...」
- **member 自己 0 個任務** → 跟上面同處理（提示去看 /tasks）
- **跨年（12 月底 → 1 月）** → 月標頭顯示「1 月」即可、不需顯示年份（28 天範圍不會跨年超過一次）
- **task 的 dueDate 跨時區** → 統一用 server 時區（local time）算 startOfDay；display 也用 local time `toLocaleDateString("zh-TW")`
- **逾期判斷** → `dueDate < startOfDay(today)`（嚴格小於）；今日到期的不算逾期

## Validation Criteria（Phase B 完工驗收）

1. ✅ Admin dashboard 上方出現 28 格 grid
2. ✅ Member dashboard 上方出現 28 格 grid，只看自己被指派
3. ✅ Q2 任務 (Alice 的、dueDate = +7 天) 在對應的未來格出現 1 個 count
4. ✅ 給任何 task 設 dueDate = 過去 → 該天 cell 變 danger-subtle
5. ✅ 今天那格有 ⭐ + accent-subtle 背景
6. ✅ Hover 有 task 的 cell → tooltip 列 task title
7. ✅ 沒 dueDate 的任務不影響 widget
8. ✅ 切日夜模式 widget 配色正確（token-only、沒寫死 hex）
9. ✅ `npm run build` 通過（13+ routes、無 type error）
10. ✅ `npm run lint`（Biome）0 warning
11. ✅ 視覺驗收：admin 跟 member 各自登入瀏覽器看一次、確認位置 / 高亮 / tooltip 都對

## Roadmap Context（為什麼分這個 phase）

完整 calendar 加 Jira 計畫共 7 個 phase（其他每個各自獨立 spec）：

| Phase | 內容 | 為什麼這個順序 |
|---|---|---|
| **B (this)** | Calendar widget 本體（4 週 mini grid） | 使用者第一優先要看到的東西 |
| A | Task.completedAt + 「結案」按鈕 + dim done task | 影響 widget render（done 是否半透明）、其他 phase 也會用 |
| C | `/calendar/[date]` drill-down 頁 | widget cell click 互動入口 |
| D | Jira OAuth + dashboard widget read-only | 獨立大塊，跟 calendar 互不依賴；做完 B C 對 widget 模式熟了再上 |
| E | 國定假日標示（TW） | polish、低風險 |
| F | drag-drop 改 dueDate | 互動性高、UI 重；放後段 |
| G | 月 / 週 view 切換 | optional polish |

每個 phase 完工後**必須**通過 Validation Criteria + manual smoke test 才能進下個 phase（使用者明確要求 — 不要一次堆一堆）。

## Verification Gate（Phase B 完成定義）

依序通過：

1. `npm run build` exit 0、13 routes（含原有的）、無 type error
2. `npm run lint` exit 0、0 warning
3. `npm run dev` 啟動成功
4. curl admin / + member /（dev impersonate 兩個都試）回 HTTP 200
5. 視覺驗收：使用者瀏覽器看一次、回報「OK」才算完工

完工後才能進 Phase A 或其他 phase 的 brainstorm。
