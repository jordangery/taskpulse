import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { FeedbackSection } from "@/components/features/feedback-section"
import { TaskQuickFeedback } from "@/components/features/task-quick-feedback"
import { archiveTask, unarchiveTask } from "@/lib/actions/tasks"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"

export default async function TasksPage() {
  const me = await getCurrentUser()
  const isAdmin = me.role === "admin"

  // 角色切換：admin 看全部、member 只看自己被指派的（未封存）
  const baseWhere = isAdmin ? {} : { assigneeId: me.id }
  const active = await prisma.task.findMany({
    where: { ...baseWhere, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      updates: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          summary: true,
          status: true,
          createdAt: true,
          _count: { select: { feedbacks: true } },
          // 列表只取最新 3 則（desc 取後再 reverse 成 asc 顯示）；完整 thread 去詳情頁
          feedbacks: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              author: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  })
  const archived = isAdmin
    ? await prisma.task.findMany({
        where: { ...baseWhere, archivedAt: { not: null } },
        orderBy: { archivedAt: "desc" },
        include: {
          assignee: { select: { id: true, name: true, role: true } },
        },
      })
    : []

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">任務</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {isAdmin
                ? `全隊現役任務 ${active.length} 筆${archived.length > 0 ? ` + ${archived.length} 筆已封存` : ""}`
                : `指派給你的任務 ${active.length} 筆`}
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/tasks/new"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent"
            >
              新增任務
            </Link>
          )}
        </header>

        {active.length === 0 ? (
          <EmptyState isAdmin={isAdmin} />
        ) : (
          <section className="space-y-3">
            {active.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isAdmin={isAdmin}
                currentUserId={me.id}
                archived={false}
              />
            ))}
          </section>
        )}

        {archived.length > 0 && (
          <section className="mt-10 space-y-3">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-text-tertiary">已封存</h2>
            {archived.map((task) => (
              <TaskCard
                key={task.id}
                task={{ ...task, updates: [] }}
                isAdmin={isAdmin}
                currentUserId={me.id}
                archived={true}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

interface FeedbackOnLatest {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
  author: { id: string; name: string }
}

interface TaskCardData {
  id: string
  title: string
  assigneeId: string
  creatorId: string
  dueDate: Date | null
  createdAt: Date
  archivedAt: Date | null
  assignee: { id: string; name: string; role: "admin" | "member" }
  updates: Array<{
    id: string
    summary: string
    status: string | null
    createdAt: Date
    feedbacks: FeedbackOnLatest[] // 最多 3 筆（desc 取，UI 端 reverse 成 asc）
    _count: { feedbacks: number }
  }>
}

function TaskCard({
  task,
  isAdmin,
  currentUserId,
  archived,
}: {
  task: TaskCardData
  isAdmin: boolean
  currentUserId: string
  archived: boolean
}) {
  const latest = task.updates[0]
  const truncated =
    latest?.summary && latest.summary.length > 60
      ? `${latest.summary.slice(0, 60)}…`
      : latest?.summary
  // 該 task 是否允許回應：未封存 + 使用者跟 task 有關（assignee / creator / admin）
  const canReplyOnTask =
    !archived && (isAdmin || currentUserId === task.assigneeId || currentUserId === task.creatorId)

  return (
    <article
      className={`rounded-md border border-border-subtle bg-surface px-4 py-4 ${
        archived ? "opacity-60" : "hover:border-border-default"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${task.id}`}
            className="text-base font-medium text-text-primary hover:text-accent"
          >
            {task.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
            <span>指派 {task.assignee.name}</span>
            {task.dueDate && <span>截止 {task.dueDate.toLocaleDateString("zh-TW")}</span>}
            {latest ? (
              <span>
                {formatDistanceToNow(latest.createdAt, { locale: zhTW, addSuffix: true })}
                更新
              </span>
            ) : (
              <span>尚無進度</span>
            )}
            {latest && latest._count.feedbacks > 0 && (
              <span className="text-accent">💬 {latest._count.feedbacks} 則回應</span>
            )}
          </div>

          {latest && (
            <div className="mt-3 rounded-md bg-canvas px-3 py-2 text-sm text-text-secondary">
              {latest.status && <StatusBadge status={latest.status} />}
              <span className={latest.status ? "ml-2" : ""}>{truncated}</span>
            </div>
          )}
        </div>

        {isAdmin && !archived && (
          <div className="flex flex-shrink-0 gap-2">
            <Link
              href={`/tasks/${task.id}/edit`}
              className="rounded-md border border-border-subtle bg-canvas px-3 py-1.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary"
            >
              編輯
            </Link>
            <form action={archiveTask.bind(null, task.id)}>
              <button
                type="submit"
                className="rounded-md bg-danger-subtle px-3 py-1.5 text-xs text-danger hover:bg-danger hover:text-text-inverse"
              >
                封存
              </button>
            </form>
          </div>
        )}

        {isAdmin && archived && (
          <form action={unarchiveTask.bind(null, task.id)}>
            <button
              type="submit"
              className="rounded-md border border-border-subtle bg-canvas px-3 py-1.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary"
            >
              還原
            </button>
          </form>
        )}
      </div>

      {/* 卡片底部：留言串（封存任務不顯示） */}
      {!archived &&
        (latest ? (
          (() => {
            // query 是 desc + take 3，UI 顯示要 asc（舊在上、新在下）
            const visibleAsc = [...latest.feedbacks].reverse()
            const total = latest._count.feedbacks
            const hiddenOlder = Math.max(0, total - visibleAsc.length)
            return (
              <FeedbackSection
                progressUpdateId={latest.id}
                feedbacks={visibleAsc.map((f) => ({
                  id: f.id,
                  content: f.content,
                  createdAt: f.createdAt.toISOString(),
                  updatedAt: f.updatedAt.toISOString(),
                  author: f.author,
                }))}
                currentUserId={currentUserId}
                canReply={canReplyOnTask}
                truncated={
                  hiddenOlder > 0
                    ? { hiddenOlderCount: hiddenOlder, detailLink: `/tasks/${task.id}` }
                    : undefined
                }
              />
            )
          })()
        ) : (
          <TaskQuickFeedback taskId={task.id} isAdmin={isAdmin} />
        ))}
    </article>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone = status.includes("完成")
    ? "bg-success-subtle text-success"
    : status.includes("卡")
      ? "bg-warning-subtle text-warning"
      : "bg-info-subtle text-info"
  return <span className={`rounded-full ${tone} px-2 py-0.5 text-xs`}>{status}</span>
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="rounded-md border border-dashed border-border-default bg-surface px-6 py-12 text-center">
      <p className="text-sm text-text-secondary">
        {isAdmin ? "還沒有任何任務。" : "目前沒有指派給你的任務。"}
      </p>
      {isAdmin && (
        <Link
          href="/tasks/new"
          className="mt-4 inline-block text-sm text-accent hover:text-accent-hover"
        >
          新增第一個任務 →
        </Link>
      )}
    </div>
  )
}
