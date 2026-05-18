import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { fetchCalendarEvents } from "@/lib/calendar"
import { prisma } from "@/lib/db"
import { DashboardCalendar } from "./dashboard-calendar"
import { DashboardJiraWidget } from "./dashboard-jira-widget"

interface Props {
  user: { id: string; name: string }
}

export async function DashboardMember({ user }: Props) {
  const [tasks, latestFeedbacks, calendar] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: user.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        updates: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { summary: true, status: true, createdAt: true },
        },
      },
    }),
    // 3 筆最近「別人寫給你」的回應
    // 範圍：你被指派的 task 上的任何 progress（不只你自己寫的），任何別人留的回應
    prisma.feedback.findMany({
      take: 3,
      orderBy: { updatedAt: "desc" },
      where: {
        authorId: { not: user.id },
        progressUpdate: { task: { assigneeId: user.id } },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { name: true } },
        progressUpdate: {
          select: {
            id: true,
            summary: true,
            task: { select: { id: true, title: true } },
          },
        },
      },
    }),
    fetchCalendarEvents(user.id, false),
  ])

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-text-primary">嗨 {user.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            指派給你的 {tasks.length} 筆任務｜最近收到 {latestFeedbacks.length} 筆回應
          </p>
        </header>

        <DashboardCalendar events={calendar.events} todayKey={calendar.todayKey} />

        {/* Jira 看板（整排） */}
        <DashboardJiraWidget scope="mine" />

        {/* 12-col：左 7 我的任務、右 5 最近回應 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="space-y-3 lg:col-span-7">
            <h2 className="text-sm font-medium text-text-secondary">我的任務</h2>
            {tasks.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-default bg-surface px-6 py-10 text-center text-sm text-text-tertiary">
                目前沒有指派給你的任務。
              </div>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => {
                  const latest = t.updates[0]
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/tasks/${t.id}`}
                        className="block rounded-md border border-border-subtle bg-surface px-4 py-3 hover:border-border-default"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-text-primary">{t.title}</span>
                          {t.dueDate && (
                            <span className="text-xs text-text-tertiary">
                              截止 {t.dueDate.toLocaleDateString("zh-TW")}
                            </span>
                          )}
                        </div>
                        {latest ? (
                          <p className="mt-1 line-clamp-1 text-xs text-text-secondary">
                            最新進度：{latest.summary}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-text-tertiary">
                            尚無進度，點進去寫第一筆
                          </p>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3 lg:col-span-5">
            <h2 className="text-sm font-medium text-text-secondary">最近收到的回應</h2>
            {latestFeedbacks.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-default bg-surface px-6 py-8 text-center text-sm text-text-tertiary">
                還沒收到回應。
              </div>
            ) : (
              <ul className="space-y-2">
                {latestFeedbacks.map((fb) => (
                  <li
                    key={fb.id}
                    className="rounded-r-md border-l-[3px] border-accent bg-info-subtle px-4 py-3"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                      <Link
                        href={`/tasks/${fb.progressUpdate.task.id}`}
                        className="font-medium text-accent hover:text-accent-hover"
                      >
                        {fb.progressUpdate.task.title}
                      </Link>
                      <span className="text-text-tertiary">— {fb.author.name}</span>
                      <span className="text-text-tertiary">
                        {formatDistanceToNow(fb.updatedAt, { locale: zhTW, addSuffix: true })}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-text-primary">{fb.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
