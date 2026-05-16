import Link from "next/link"
import { redirect } from "next/navigation"
import { CopyButton } from "@/components/features/copy-button"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"

const WEEK_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

interface TaskWithLatest {
  id: string
  title: string
  assignee: { name: string }
  updates: { status: string | null; summary: string; createdAt: Date }[]
}

function isStuck(t: TaskWithLatest): boolean {
  return t.updates[0]?.status?.includes("卡") ?? false
}
function isDone(t: TaskWithLatest): boolean {
  return t.updates[0]?.status?.includes("完成") ?? false
}

function buildPlainText(args: {
  weekStart: Date
  newTasksCount: number
  updatedTasksCount: number
  stuck: TaskWithLatest[]
  done: TaskWithLatest[]
}): string {
  const dateStr = `${args.weekStart.getMonth() + 1}/${args.weekStart.getDate()} 起算近 7 天`
  const stuckSection = args.stuck.length
    ? args.stuck
        .map((t) => `  - ${t.title}（${t.assignee.name}）：${t.updates[0]?.summary ?? ""}`)
        .join("\n")
    : "  （無）"
  const doneSection = args.done.length
    ? args.done.map((t) => `  - ${t.title}（${t.assignee.name}）`).join("\n")
    : "  （無）"

  return [
    `Taskpulse 本週重點（${dateStr}）`,
    "",
    `• 本週新增任務：${args.newTasksCount} 筆`,
    `• 本週有進度更新的任務：${args.updatedTasksCount} 個`,
    "",
    "卡住的任務：",
    stuckSection,
    "",
    "完成的任務：",
    doneSection,
    "",
  ].join("\n")
}

export default async function ReportsPage() {
  const me = await getCurrentUser()
  if (me.role !== "admin") redirect("/")

  const weekStart = new Date(Date.now() - WEEK_DAYS * MS_PER_DAY)

  const [activeTasks, newTasksCount, updatedTaskIdsRaw] = await Promise.all([
    prisma.task.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        assignee: { select: { name: true } },
        updates: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { status: true, summary: true, createdAt: true },
        },
      },
    }),
    prisma.task.count({
      where: { archivedAt: null, createdAt: { gte: weekStart } },
    }),
    prisma.progressUpdate.findMany({
      where: { createdAt: { gte: weekStart } },
      select: { taskId: true },
      distinct: ["taskId"],
    }),
  ])
  const updatedTasksCount = updatedTaskIdsRaw.length

  const stuck = activeTasks.filter(isStuck)
  const done = activeTasks.filter(isDone)

  const plainText = buildPlainText({
    weekStart,
    newTasksCount,
    updatedTasksCount,
    stuck,
    done,
  })

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">向上回報摘要</h1>
            <p className="mt-1 text-sm text-text-secondary">
              近 7 天｜admin 專用｜純 server-side render，沒打外部 API
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/api/export"
              className="rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-subtle hover:text-text-primary"
            >
              下載 JSON 備份
            </Link>
            <CopyButton text={plainText} />
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="本週新增任務" value={newTasksCount} />
          <StatCard label="本週有進度更新的任務" value={updatedTasksCount} />
        </section>

        <section className="rounded-md border border-border-subtle bg-surface px-5 py-4">
          <h2 className="mb-3 text-sm font-medium text-text-primary">卡住的任務</h2>
          {stuck.length === 0 ? (
            <p className="text-sm text-text-tertiary">沒有卡住的任務 👌</p>
          ) : (
            <ul className="space-y-2">
              {stuck.map((t) => (
                <TaskRow key={t.id} task={t} tone="warning" />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-border-subtle bg-surface px-5 py-4">
          <h2 className="mb-3 text-sm font-medium text-text-primary">完成的任務</h2>
          {done.length === 0 ? (
            <p className="text-sm text-text-tertiary">本週還沒有完成的任務。</p>
          ) : (
            <ul className="space-y-2">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} tone="success" />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-border-subtle bg-surface px-5 py-4">
          <h2 className="mb-2 text-sm font-medium text-text-primary">純文字預覽</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-canvas px-4 py-3 text-xs text-text-secondary">
            {plainText}
          </pre>
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-md border border-border-subtle bg-surface px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-text-tertiary">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-text-primary">{value}</div>
    </article>
  )
}

function TaskRow({ task, tone }: { task: TaskWithLatest; tone: "warning" | "success" }) {
  const accent =
    tone === "warning" ? "border-l-warning bg-warning-subtle" : "border-l-success bg-success-subtle"
  const latest = task.updates[0]
  return (
    <li className={`rounded-r-md border-l-[3px] ${accent} px-4 py-2`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={`/tasks/${task.id}`}
          className="font-medium text-text-primary hover:text-accent"
        >
          {task.title}
        </Link>
        <span className="text-xs text-text-tertiary">— {task.assignee.name}</span>
      </div>
      {latest && <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{latest.summary}</p>}
    </li>
  )
}
