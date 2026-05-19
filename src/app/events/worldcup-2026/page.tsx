// 2026 世界盃 — 格里昂 APP 戰隊
// 拉斯維加斯霓虹 + 賭城金 + FIFA 主題色（黑底、金、霓虹粉、電光藍）
// 這頁不走 design-system token，故意設計成「跟整個 dashboard 截然不同」
// 一次性主題頁、不可重複利用

import Link from "next/link"
import { DATES, HEADLINE_MATCHES, type ShiftCode, TEAMS, WEEKDAYS } from "./schedule-data"

export const metadata = {
  title: "WORLD CUP 2026 · 格里昂 APP 戰隊",
  description: "2026 美加墨世界盃 — 格里昂 App 戰隊作戰排班",
}

// Vegas palette — 直接寫死 hex / rgba，不走 token
const SHIFT_COLORS: Record<ShiftCode, { bg: string; text: string; ring: string; label: string }> = {
  M: {
    bg: "linear-gradient(135deg, #FFB300 0%, #FFD700 100%)",
    text: "#1a0a00",
    ring: "0 0 12px rgba(255, 215, 0, 0.7)",
    label: "早班",
  },
  N: {
    bg: "linear-gradient(135deg, #C2185B 0%, #E91E63 50%, #9C27B0 100%)",
    text: "#fff",
    ring: "0 0 14px rgba(233, 30, 99, 0.85)",
    label: "晚班",
  },
  H: {
    bg: "linear-gradient(135deg, #00ACC1 0%, #00E5FF 100%)",
    text: "#001020",
    ring: "0 0 14px rgba(0, 229, 255, 0.7)",
    label: "假日加班",
  },
  off: {
    bg: "transparent",
    text: "rgba(255,255,255,0.18)",
    ring: "inset 0 0 0 1px rgba(255,255,255,0.06)",
    label: "休假",
  },
}

const TOURNAMENT_START = new Date("2026-06-11T00:00:00")
const TOURNAMENT_END = new Date("2026-07-19T23:59:59")

function daysFromNowTo(target: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = new Date(target)
  t.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

// 班表格子裡的縮寫（cell 只有 26px 寬，用單字）
const CELL_LABEL: Record<Exclude<ShiftCode, "off">, string> = {
  M: "早",
  N: "晚",
  H: "加",
}

// 根據比賽日期 + 時間，找出當下值班的人
// 班別時段：
//   M 早班  8 ~ 10
//   N 晚班  23 ~ 隔天 8（跨日，半夜的賽事要往前一天找 N）
//   H 假日加班  9 ~ 14
function onDutyAt(
  matchDate: string,
  matchTime: string,
): {
  iOS: { name: string; shift: Exclude<ShiftCode, "off"> }[]
  Android: { name: string; shift: Exclude<ShiftCode, "off"> }[]
} {
  const hh = Number.parseInt(matchTime.split(":")[0] ?? "0", 10)
  const dateIdx = DATES.indexOf(matchDate as (typeof DATES)[number])
  const result: ReturnType<typeof onDutyAt> = { iOS: [], Android: [] }
  if (dateIdx < 0) return result

  for (const team of TEAMS) {
    for (const member of team.members) {
      const today = member.shifts[dateIdx]
      const yesterday = dateIdx > 0 ? member.shifts[dateIdx - 1] : "off"

      let active: Exclude<ShiftCode, "off"> | null = null
      // 0:00-7:59 → 昨晚的 N 還沒下班
      if (hh < 8 && yesterday === "N") active = "N"
      // 23:00 之後 → 今天的 N 剛上線
      else if (hh >= 23 && today === "N") active = "N"
      // 8:00-9:59 → 早班
      else if (hh >= 8 && hh < 10 && today === "M") active = "M"
      // 9:00-13:59 → 假日加班
      else if (hh >= 9 && hh < 14 && today === "H") active = "H"

      if (active) {
        result[team.team].push({ name: member.name, shift: active })
      }
    }
  }
  return result
}

export default function WorldCup2026Page() {
  const daysToStart = daysFromNowTo(TOURNAMENT_START)
  const daysToEnd = daysFromNowTo(TOURNAMENT_END)
  const inProgress = daysToStart <= 0 && daysToEnd >= 0
  const ended = daysToEnd < 0

  return (
    <div
      className="relative -mx-6 -my-6 min-h-screen overflow-hidden px-6 py-10"
      style={{
        background: "radial-gradient(ellipse at top, #2a0040 0%, #0a0014 45%, #000000 100%)",
        color: "#fff",
      }}
    >
      {/* 背景閃光點：CSS-only stars */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(2px 2px at 20% 30%, #FFD700 0%, transparent 50%), radial-gradient(1.5px 1.5px at 70% 60%, #FF1493 0%, transparent 50%), radial-gradient(1px 1px at 40% 80%, #00E5FF 0%, transparent 50%), radial-gradient(2px 2px at 85% 20%, #FFD700 0%, transparent 50%), radial-gradient(1.5px 1.5px at 15% 70%, #FFFFFF 0%, transparent 50%)",
          backgroundSize: "100% 100%",
        }}
      />

      <div className="relative mx-auto max-w-6xl space-y-10">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs tracking-wider text-amber-300 transition hover:text-amber-200"
          style={{ textShadow: "0 0 8px rgba(255, 200, 0, 0.5)" }}
        >
          ← BACK TO DASHBOARD
        </Link>

        {/* HERO */}
        <header className="text-center">
          <p
            className="mb-2 text-xs tracking-[0.5em] text-pink-400"
            style={{ textShadow: "0 0 10px rgba(255, 20, 147, 0.8)" }}
          >
            FIFA WORLD CUP · UNITED 2026
          </p>
          <h1
            className="text-6xl font-black uppercase tracking-tight md:text-8xl"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #FFE57F 0%, #FFD700 35%, #FF9800 70%, #C68B00 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 25px rgba(255, 215, 0, 0.45))",
              fontFamily: "'Impact', 'Oswald', 'Helvetica Neue', sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            World Cup
            <br />
            2026
          </h1>
          <p
            className="mt-3 text-2xl font-bold text-amber-200"
            style={{ textShadow: "0 0 14px rgba(255, 215, 0, 0.6)" }}
          >
            🇨🇦 🇲🇽 🇺🇸 · 6/11 — 7/19
          </p>
          <p className="mt-1 text-sm tracking-widest text-pink-300/80">
            格里昂 APP 戰隊 · 全員上線
          </p>

          {/* Countdown */}
          <div
            className="mt-6 inline-flex items-baseline gap-3 rounded-md px-5 py-3"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,20,147,0.15), rgba(255,215,0,0.15), rgba(0,229,255,0.15))",
              boxShadow: "0 0 25px rgba(255, 215, 0, 0.3), inset 0 0 12px rgba(255, 20, 147, 0.2)",
              border: "1px solid rgba(255, 215, 0, 0.4)",
            }}
          >
            {ended ? (
              <span className="text-lg font-bold text-amber-200">賽事已落幕 🏆</span>
            ) : inProgress ? (
              <>
                <span className="text-xs uppercase tracking-widest text-pink-300">LIVE NOW</span>
                <span className="text-3xl font-black text-amber-300">{daysToEnd}</span>
                <span className="text-sm text-amber-100">天到收官</span>
              </>
            ) : (
              <>
                <span className="text-xs uppercase tracking-widest text-pink-300">COUNTDOWN</span>
                <span
                  className="text-5xl font-black"
                  style={{
                    backgroundImage: "linear-gradient(180deg, #FF6EC4, #FFD700, #00E5FF)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 0 12px rgba(255, 110, 196, 0.6))",
                  }}
                >
                  {daysToStart}
                </span>
                <span className="text-sm text-amber-100">天開踢</span>
              </>
            )}
          </div>
        </header>

        {/* TOURNAMENT STATS */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { v: "48", k: "支隊伍" },
            { v: "16", k: "主辦城市" },
            { v: "104", k: "場比賽" },
            { v: "39", k: "天作戰" },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-lg px-4 py-5 text-center"
              style={{
                background: "rgba(255, 215, 0, 0.08)",
                border: "1px solid rgba(255, 215, 0, 0.3)",
                boxShadow: "0 0 18px rgba(255, 215, 0, 0.15)",
                backdropFilter: "blur(6px)",
              }}
            >
              <p
                className="text-4xl font-black text-amber-300"
                style={{ textShadow: "0 0 12px rgba(255, 215, 0, 0.7)" }}
              >
                {s.v}
              </p>
              <p className="mt-1 text-xs tracking-widest text-amber-100/80">{s.k}</p>
            </div>
          ))}
        </section>

        {/* HEADLINE MATCHES */}
        <section>
          <SectionTitle
            kicker="HIGHLIGHT MATCHES"
            title="關鍵戰役"
            tail={`開幕到捧盃 · ${HEADLINE_MATCHES.length} 場別錯過 · 全部以台北時間 (UTC+8) 表示`}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HEADLINE_MATCHES.map((m) => {
              const duty = onDutyAt(m.date, m.time)
              const totalOn = duty.iOS.length + duty.Android.length
              return (
                <div
                  key={`${m.date}-${m.time}-${m.title}`}
                  className="group relative min-h-[140px] overflow-hidden rounded-lg transition-transform hover:scale-[1.02]"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(76, 0, 153, 0.25), rgba(20, 0, 40, 0.6))",
                    border: "1px solid rgba(255, 20, 147, 0.35)",
                    boxShadow:
                      "0 0 14px rgba(255, 20, 147, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
                  }}
                >
                  {/* 預設層：比賽資訊 */}
                  <div className="px-4 py-3 transition-opacity duration-200 group-hover:opacity-0">
                    <div className="flex items-baseline justify-between">
                      <span
                        className="font-mono text-sm font-bold text-pink-300"
                        style={{ textShadow: "0 0 8px rgba(255,20,147,0.7)" }}
                      >
                        {m.date}
                      </span>
                      <span className="text-xs text-amber-200/70">{m.time}</span>
                    </div>
                    <p className="mt-1 text-base font-bold text-amber-100">{m.title}</p>
                    {m.stage && (
                      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-amber-300/60">
                        {m.stage}
                      </p>
                    )}
                    <p
                      className="mt-2 text-[10px] uppercase tracking-widest text-cyan-300/70"
                      style={{ textShadow: "0 0 6px rgba(0,229,255,0.5)" }}
                    >
                      {totalOn > 0 ? `🎧 hover 看 ${totalOn} 位值班` : "🌙 此時段無人值班"}
                    </p>
                  </div>

                  {/* hover 覆蓋層：值班名單 — 蓋在卡片上、不外伸 */}
                  <div
                    className="absolute inset-0 flex flex-col px-4 py-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    style={{
                      background: "#15001f",
                      borderLeft: "3px solid rgba(0, 229, 255, 0.8)",
                    }}
                  >
                    <p
                      className="mb-2 text-[11px] font-bold tracking-widest text-cyan-300"
                      style={{ textShadow: "0 0 8px rgba(0,229,255,0.7)" }}
                    >
                      值班 · {m.date} {m.time}
                    </p>
                    {totalOn === 0 ? (
                      <p className="text-xs text-amber-100/70">這個時段沒有人在班 — 注意覆蓋</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {[...duty.iOS, ...duty.Android].map((p) => {
                          const c = SHIFT_COLORS[p.shift]
                          return (
                            <span
                              key={`${m.date}-${m.time}-${p.name}`}
                              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] font-bold"
                              style={{
                                background: c.bg,
                                color: c.text,
                                boxShadow: c.ring,
                              }}
                            >
                              {p.name}
                              <span className="text-[10px] opacity-80">·{CELL_LABEL[p.shift]}</span>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* DIVIDER */}
        <div
          className="mx-auto h-px w-3/4"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.8), rgba(255, 20, 147, 0.8), rgba(0, 229, 255, 0.6), transparent)",
            boxShadow: "0 0 16px rgba(255, 215, 0, 0.5)",
          }}
        />

        {/* STAFF SCHEDULE */}
        <section>
          <SectionTitle
            kicker="GERYON APP TEAM · DUTY ROSTER"
            title="作戰排班表"
            tail="iOS 5 人 · Android 7 人 · 6/1 — 7/31 共 61 天"
          />

          {/* Legend */}
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {(["M", "N", "H", "off"] as ShiftCode[]).map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <span
                  className="inline-block h-3 w-5 rounded-sm"
                  style={{
                    background: SHIFT_COLORS[s].bg,
                    boxShadow: SHIFT_COLORS[s].ring,
                  }}
                />
                <span className="text-amber-100/80">{SHIFT_COLORS[s].label}</span>
              </span>
            ))}
          </div>

          {TEAMS.map((team) => (
            <ScheduleGrid key={team.team} team={team.team} members={team.members} />
          ))}
        </section>

        {/* FOOTER */}
        <footer className="pt-6 text-center">
          <p
            className="text-xs uppercase tracking-[0.4em] text-amber-300/60"
            style={{ textShadow: "0 0 8px rgba(255, 215, 0, 0.4)" }}
          >
            ★ GERYON × WORLD CUP 2026 ★
          </p>
          <p className="mt-1 text-[11px] text-pink-300/40">
            taskpulse internal event page · APP team only
          </p>
        </footer>
      </div>
    </div>
  )
}

function SectionTitle({ kicker, title, tail }: { kicker: string; title: string; tail?: string }) {
  return (
    <header className="mb-5">
      <p
        className="text-xs tracking-[0.4em] text-pink-400"
        style={{ textShadow: "0 0 8px rgba(255,20,147,0.5)" }}
      >
        {kicker}
      </p>
      <h2
        className="mt-1 text-3xl font-black uppercase text-amber-300 md:text-4xl"
        style={{
          textShadow: "0 0 18px rgba(255, 215, 0, 0.6), 0 2px 0 rgba(0,0,0,0.5)",
          fontFamily: "'Impact', 'Oswald', sans-serif",
          letterSpacing: "0.02em",
        }}
      >
        {title}
      </h2>
      {tail && <p className="mt-1 text-sm text-amber-100/60">{tail}</p>}
    </header>
  )
}

function ScheduleGrid({
  team,
  members,
}: {
  team: "iOS" | "Android"
  members: { name: string; code: string; shifts: ShiftCode[] }[]
}) {
  const teamColor =
    team === "iOS"
      ? "linear-gradient(90deg, #FF1493 0%, #FFD700 100%)"
      : "linear-gradient(90deg, #00E5FF 0%, #FFD700 100%)"

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-baseline gap-3">
        <h3
          className="text-xl font-black uppercase"
          style={{
            backgroundImage: teamColor,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))",
            fontFamily: "'Impact', 'Oswald', sans-serif",
            letterSpacing: "0.05em",
          }}
        >
          {team === "iOS" ? "📱 iOS 隊" : "🤖 Android 隊"}
        </h3>
        <span className="text-xs text-amber-100/50">{members.length} 人</span>
      </div>

      <div
        className="overflow-x-auto rounded-lg"
        style={{
          background: "linear-gradient(180deg, rgba(255,215,0,0.05), rgba(0,0,0,0.4))",
          border: "1px solid rgba(255, 215, 0, 0.25)",
          boxShadow: "0 0 18px rgba(255, 215, 0, 0.1)",
        }}
      >
        <table className="w-full border-separate" style={{ borderSpacing: 0 }}>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 px-3 py-2 text-left text-xs uppercase tracking-wider"
                style={{
                  background: "rgba(0, 0, 0, 0.85)",
                  color: "#FFD700",
                  borderBottom: "1px solid rgba(255, 215, 0, 0.3)",
                  borderRight: "1px solid rgba(255, 215, 0, 0.2)",
                }}
              >
                Staff
              </th>
              {DATES.map((d, i) => {
                const wd = WEEKDAYS[i]
                const isWeekend = wd === "六" || wd === "日"
                const isTournament =
                  (d.startsWith("6/") && Number(d.split("/")[1]) >= 11) ||
                  (d.startsWith("7/") && Number(d.split("/")[1]) <= 19)
                return (
                  <th
                    key={d}
                    className="px-1 py-1 text-center text-[10px] font-medium"
                    style={{
                      minWidth: "26px",
                      color: isTournament
                        ? "#FFD700"
                        : isWeekend
                          ? "#FF6EC4"
                          : "rgba(255,255,255,0.5)",
                      borderBottom: isTournament
                        ? "2px solid rgba(255, 215, 0, 0.6)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      background: isTournament ? "rgba(255, 215, 0, 0.06)" : "transparent",
                    }}
                  >
                    <div>{d}</div>
                    <div style={{ opacity: 0.6 }}>{wd}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.code}>
                <td
                  className="sticky left-0 z-10 px-3 py-1.5 text-sm font-medium"
                  style={{
                    background: "rgba(0, 0, 0, 0.85)",
                    color: "#FFE57F",
                    borderRight: "1px solid rgba(255, 215, 0, 0.2)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.name}
                  <span className="ml-1.5 text-[10px] text-amber-200/40">#{m.code}</span>
                </td>
                {m.shifts.map((s, i) => {
                  const c = SHIFT_COLORS[s]
                  return (
                    <td
                      key={`${m.code}-${DATES[i]}`}
                      title={`${m.name} · ${DATES[i]} ${WEEKDAYS[i]} · ${c.label}`}
                      style={{
                        background: c.bg,
                        color: c.text,
                        boxShadow: c.ring,
                        borderBottom: "1px solid rgba(0,0,0,0.4)",
                        textAlign: "center",
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "4px 2px",
                        minWidth: "26px",
                      }}
                    >
                      {s === "off" ? "" : CELL_LABEL[s]}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
