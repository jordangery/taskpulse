import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ProgressUpdateForm } from "@/components/features/progress-update-form"
import { ProgressUpdateList } from "@/components/features/progress-update-list"
import { createProgressUpdate } from "@/lib/actions/progress-updates"
import { archiveTask, unarchiveTask } from "@/lib/actions/tasks"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TaskDetailPage({ params }: PageProps) {
  const me = await getCurrentUser()
  const { id } = await params

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      creator: { select: { id: true, name: true } },
      updates: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          summary: true,
          percentage: true,
          status: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!task) notFound()

  // member 只能看自己被指派的；admin 看全部
  if (me.role !== "admin" && task.assigneeId !== me.id) redirect("/tasks")

  const isAdmin = me.role === "admin"
  const isArchived = task.archivedAt !== null
  // 任何能看到此頁的人都能寫進度（member 限自己的、admin 任何）；封存任務除外
  const canWriteUpdate = !isArchived
  const lastMineAt = task.updates.find((u) => u.author.id === me.id)?.createdAt ?? null

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <Link href="/tasks" className="text-xs text-text-tertiary hover:text-text-secondary">
            ← 回任務列表
          </Link>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold text-text-primary">{task.title}</h1>
            {isAdmin && (
              <div className="flex flex-shrink-0 gap-2">
                {!isArchived && (
                  <Link
                    href={`/tasks/${task.id}/edit`}
                    className="rounded-md border border-border-subtle bg-canvas px-3 py-1.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary"
                  >
                    編輯
                  </Link>
                )}
                <form
                  action={
                    isArchived ? unarchiveTask.bind(null, task.id) : archiveTask.bind(null, task.id)
                  }
                >
                  <button
                    type="submit"
                    className={
                      isArchived
                        ? "rounded-md border border-border-subtle bg-canvas px-3 py-1.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary"
                        : "rounded-md bg-danger-subtle px-3 py-1.5 text-xs text-danger hover:bg-danger hover:text-text-inverse"
                    }
                  >
                    {isArchived ? "還原" : "封存"}
                  </button>
                </form>
              </div>
            )}
          </div>
          {isArchived && (
            <p className="text-xs text-warning">
              已封存於 {task.archivedAt?.toLocaleString("zh-TW")}
            </p>
          )}
        </header>

        <section className="rounded-md border border-border-subtle bg-surface px-5 py-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Meta label="指派給" value={task.assignee.name} />
            <Meta label="建立者" value={task.creator.name} />
            <Meta
              label="截止日"
              value={task.dueDate ? task.dueDate.toLocaleDateString("zh-TW") : "—"}
            />
            <Meta
              label="建立於"
              value={formatDistanceToNow(task.createdAt, { locale: zhTW, addSuffix: true })}
            />
          </dl>
          {task.description && (
            <div className="mt-4 border-t border-border-subtle pt-4">
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{task.description}</p>
            </div>
          )}
        </section>

        {canWriteUpdate && (
          <ProgressUpdateForm
            taskId={task.id}
            action={createProgressUpdate}
            lastMineAt={lastMineAt ? lastMineAt.toISOString() : null}
          />
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-text-secondary">
            進度歷史（{task.updates.length} 筆，最新在最上面）
          </h2>
          <ProgressUpdateList updates={task.updates} />
        </section>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-tertiary">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  )
}
