import type { Prisma } from "@prisma/client"
import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import Link from "next/link"
import { FeedbackSection } from "@/components/features/feedback-section"
import {
  type ShowValue,
  type SortValue,
  TaskListFilters,
} from "@/components/features/task-list-filters"
import { TaskQuickFeedback } from "@/components/features/task-quick-feedback"
import { archiveTask, unarchiveTask } from "@/lib/actions/tasks"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"

interface SearchParams {
  q?: string
  assignee?: string
  status?: string
  overdue?: string
  sort?: SortValue
  show?: ShowValue
}

interface PageProps {
  searchParams: Promise<SearchParams>
}

export default async function TasksPage({ searchParams }: PageProps) {
  const me = await getCurrentUser()
  const isAdmin = me.role === "admin"
  const params = await searchParams
  const q = params.q?.trim() || ""
  const assigneeFilter = params.assignee?.trim() || ""
  const statusFilter = params.status?.trim() || ""
  const overdueOnly = params.overdue === "1"
  const sort = (params.sort ?? "created") as SortValue
  const show = (params.show ?? "active") as ShowValue

  // 角色切換：admin 看全部、member 只看自己被指派的（未封存）
  const baseWhere: Prisma.TaskWhereInput = isAdmin ? {} : { assigneeId: me.id }
  // 搜尋：標題 + 描述
  if (q) {
    baseWhere.OR = [{ title: { contains: q } }, { description: { contains: q } }]
  }
  // assignee 過濾（admin only — member 已被 baseWhere 鎖死自己）
  if (isAdmin && assigneeFilter) baseWhere.assigneeId = assigneeFilter
  // 逾期過濾
  if (overdueOnly) {
    baseWhere.dueDate = { lt: new Date(), not: null }
  }
  // 結案過濾：預設只看活躍（completedAt null），可切「已結案」/「全部」
  if (show === "active") {
    baseWhere.completedAt = null
  } else if (show === "closed") {
    baseWhere.completedAt = { not: null }
  }
  // show === "all" → 不加條件

  // 排序：created (default desc) / due (asc, nulls last) / activity (JS 端排，需 query 完再算)
  const orderBy: Prisma.TaskOrderByWithRelationInput =
    sort === "due" ? { dueDate: { sort: "asc", nulls: "last" } } : { createdAt: "desc" }

  const active = await prisma.task.findMany({
    where: { ...baseWhere, archivedAt: null },
    orderBy,
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
        // 已封存區塊不套 search/filter（讓使用者方便看完整封存）
        where: { archivedAt: { not: null } },
        orderBy: { archivedAt: "desc" },
        include: {
          assignee: { select: { id: true, name: true, role: true } },
        },
      })
    : []

  // 後處理：status filter 跟 activity sort 都靠最新 update，SQL 表達麻煩，在 JS 端做
  const filteredActive = statusFilter
    ? active.filter((t) => t.updates[0]?.status === statusFilter)
    : active

  const sortedActive =
    sort === "activity"
      ? [...filteredActive].sort((a, b) => {
          const aTime = a.updates[0]?.createdAt.getTime() ?? a.createdAt.getTime()
          const bTime = b.updates[0]?.createdAt.getTime() ?? b.createdAt.getTime()
          return bTime - aTime
        })
      : filteredActive

  // admin 看到全成員下拉；未封存的成員才放
  const assignees = isAdmin
    ? await prisma.user.findMany({
        where: { archivedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : undefined

  const hasFilters = !!(
    q ||
    assigneeFilter ||
    statusFilter ||
    overdueOnly ||
    sort !== "created" ||
    show !== "active"
  )

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">任務</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {hasFilters
                ? `符合篩選條件 ${sortedActive.length} 筆`
                : isAdmin
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

        <TaskListFilters assignees={assignees} />

        {sortedActive.length === 0 ? (
          hasFilters ? (
            <FilteredEmpty />
          ) : (
            <EmptyState isAdmin={isAdmin} />
          )
        ) : (
          <section className="space-y-3">
            {sortedActive.map((task) => (
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
  completedAt: Date | null
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
  const isCompleted = task.completedAt !== null
  // 該 task 是否允許回應：未封存 + 使用者跟 task 有關（assignee / creator / admin）
  const canReplyOnTask =
    !archived && (isAdmin || currentUserId === task.assigneeId || currentUserId === task.creatorId)

  // 封存：完全淡化、不 hover；結案：淡化但仍可 hover 互動
  const cardClass = archived
    ? "opacity-60"
    : isCompleted
      ? "opacity-60 hover:border-border-default"
      : "hover:border-border-default"
  return (
    <article className={`rounded-md border border-border-subtle bg-surface px-4 py-4 ${cardClass}`}>
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
            {isCompleted && <span className="text-success">✓ 已結案</span>}
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

function FilteredEmpty() {
  return (
    <div className="rounded-md border border-dashed border-border-default bg-surface px-6 py-12 text-center">
      <p className="text-sm text-text-secondary">沒有符合條件的任務。</p>
      <p className="mt-1 text-xs text-text-tertiary">改一下篩選條件或點「清除全部」看完整列表。</p>
    </div>
  )
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
