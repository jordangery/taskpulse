import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import { FeedbackSection, type FeedbackThreadItem } from "./feedback-section"

interface FeedbackRow {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
  author: { id: string; name: string }
}

interface ProgressUpdateItem {
  id: string
  summary: string
  percentage: number | null
  status: string | null
  createdAt: Date
  author: { id: string; name: string }
  feedbacks: FeedbackRow[]
}

interface ProgressUpdateListProps {
  updates: ProgressUpdateItem[]
  currentUserId: string
  canReplyOnTask: boolean // 該 task 是否允許回應（非封存 + 使用者跟 task 有關係）
}

export function ProgressUpdateList({
  updates,
  currentUserId,
  canReplyOnTask,
}: ProgressUpdateListProps) {
  if (updates.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-default bg-surface px-6 py-10 text-center">
        <p className="text-sm text-text-secondary">還沒有進度紀錄。</p>
        <p className="mt-1 text-xs text-text-tertiary">
          進度是 append-only，寫錯就再寫一筆，不刪舊紀錄。
        </p>
      </div>
    )
  }

  return (
    <ol className="space-y-3">
      {updates.map((u) => (
        <ProgressUpdateCard
          key={u.id}
          update={u}
          currentUserId={currentUserId}
          canReply={canReplyOnTask}
        />
      ))}
    </ol>
  )
}

function ProgressUpdateCard({
  update,
  currentUserId,
  canReply,
}: {
  update: ProgressUpdateItem
  currentUserId: string
  canReply: boolean
}) {
  return (
    <li className="rounded-md border border-border-subtle bg-surface px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{update.author.name}</span>
          {update.status && <StatusPill status={update.status} />}
          {update.percentage !== null && (
            <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-xs text-primary">
              {update.percentage}%
            </span>
          )}
        </div>
        <time className="text-xs text-text-tertiary" dateTime={update.createdAt.toISOString()}>
          {formatDistanceToNow(update.createdAt, { locale: zhTW, addSuffix: true })}
        </time>
      </div>
      <p className="whitespace-pre-wrap text-sm text-text-primary">{update.summary}</p>

      <FeedbackSection
        progressUpdateId={update.id}
        feedbacks={update.feedbacks.map<FeedbackThreadItem>((f) => ({
          id: f.id,
          content: f.content,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
          author: f.author,
        }))}
        currentUserId={currentUserId}
        canReply={canReply}
      />
    </li>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone = status.includes("完成")
    ? "bg-success-subtle text-success"
    : status.includes("卡")
      ? "bg-warning-subtle text-warning"
      : status.includes("待")
        ? "bg-accent-subtle text-accent"
        : "bg-info-subtle text-info"
  return <span className={`rounded-full ${tone} px-2 py-0.5 text-xs`}>{status}</span>
}
