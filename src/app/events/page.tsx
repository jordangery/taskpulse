// /events 索引頁：列出所有事件
// 包含：
//   1. 客製頁面（hardcoded landing page，例：2026 世界盃）
//   2. DB 裡的 Event row（普通日曆事件）

import Link from "next/link"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"

// 寫死的「重點客製事件頁」清單 — 每個對應一個 file-system route
const FEATURED_EVENTS = [
  {
    href: "/events/worldcup-2026",
    title: "2026 世界盃 · 格里昂 APP 戰隊",
    range: "2026/6/11 — 2026/7/19",
    accent:
      "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,20,147,0.15), rgba(0,229,255,0.12))",
    badge: "🏆 客製專頁",
  },
]

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export default async function EventsIndexPage() {
  await getCurrentUser()

  // 撈未來 + 進行中 + 過去 30 天的 DB 事件
  const now = new Date()
  const lookbackStart = new Date(now)
  lookbackStart.setDate(lookbackStart.getDate() - 30)

  const events = await prisma.event.findMany({
    where: { endDate: { gte: lookbackStart } },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      creator: { select: { name: true } },
      participants: { select: { user: { select: { name: true } } } },
    },
  })

  // 分組：進行中 / 未來 / 已結束
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const active = events.filter((e) => e.startDate <= now && e.endDate >= today)
  const upcoming = events.filter((e) => e.startDate > now)
  const past = events.filter((e) => e.endDate < today)

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-text-primary">事件</h1>
          <p className="mt-1 text-sm text-text-secondary">
            重點賽事、公司活動、跨日任務都在這裡。客製專頁 + 日曆事件統一入口。
          </p>
        </header>

        {/* 客製專頁 — 永遠最上面 */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-text-secondary">客製專頁</h2>
          <ul className="space-y-2">
            {FEATURED_EVENTS.map((e) => (
              <li key={e.href}>
                <Link
                  href={e.href}
                  className="block rounded-md border border-border-subtle bg-surface px-4 py-3 transition hover:border-border-default"
                  style={{ background: e.accent }}
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                      {e.badge}
                    </span>
                    <span className="text-xs text-text-tertiary">{e.range}</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-text-primary">{e.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* DB events 三段 */}
        {active.length > 0 && (
          <Section title={`進行中（${active.length}）`}>
            {active.map((e) => (
              <EventCard key={e.id} event={e} tone="active" />
            ))}
          </Section>
        )}
        {upcoming.length > 0 && (
          <Section title={`即將到來（${upcoming.length}）`}>
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} tone="upcoming" />
            ))}
          </Section>
        )}
        {past.length > 0 && (
          <Section title={`近 30 天內結束（${past.length}）`}>
            {past.map((e) => (
              <EventCard key={e.id} event={e} tone="past" />
            ))}
          </Section>
        )}

        {events.length === 0 && (
          <section className="rounded-md border border-dashed border-border-default bg-surface px-6 py-10 text-center text-sm text-text-tertiary">
            目前沒有日曆事件。去日曆任一天點「+ 新增事件」可以加。
          </section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-text-secondary">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

interface DbEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  creator: { name: string }
  participants: { user: { name: string } }[]
}

function EventCard({ event, tone }: { event: DbEvent; tone: "active" | "upcoming" | "past" }) {
  const sameDay = toDateKey(event.startDate) === toDateKey(event.endDate)
  const rangeStr = sameDay
    ? toDateKey(event.startDate)
    : `${toDateKey(event.startDate)} ~ ${toDateKey(event.endDate)}`
  const opacityCls = tone === "past" ? "opacity-70" : ""
  // 進行中：左側加 accent stripe；未來：bg-subtle
  const stripe =
    tone === "active"
      ? "border-l-4 border-l-accent"
      : tone === "upcoming"
        ? "border-l-4 border-l-info"
        : ""

  return (
    <li>
      <Link
        href={`/calendar/${toDateKey(event.startDate)}`}
        className={`block rounded-md border border-border-subtle bg-surface px-4 py-3 hover:border-border-default ${opacityCls} ${stripe}`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-text-primary">{event.title}</p>
          <span className="flex-shrink-0 text-xs text-text-tertiary">{rangeStr}</span>
        </div>
        <p className="mt-1 text-xs text-text-tertiary">
          建立者 {event.creator.name}
          {event.participants.length > 0 && (
            <span className="ml-2">· {event.participants.map((p) => p.user.name).join(" / ")}</span>
          )}
        </p>
      </Link>
    </li>
  )
}
