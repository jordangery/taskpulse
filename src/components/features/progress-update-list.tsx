import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import { FeedbackSection } from "./feedback-section"

interface FeedbackData {
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
  feedback: FeedbackData | null
}

interface ProgressUpdateListProps {
  updates: ProgressUpdateItem[]
  isAdmin: boolean
}

export function ProgressUpdateList({ updates, isAdmin }: ProgressUpdateListProps) {
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
        <ProgressUpdateCard key={u.id} update={u} isAdmin={isAdmin} />
      ))}
    </ol>
  )
}

function ProgressUpdateCard({ update, isAdmin }: { update: ProgressUpdateItem; isAdmin: boolean }) {
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
        feedback={
          update.feedback
            ? {
                id: update.feedback.id,
                content: update.feedback.content,
                createdAt: update.feedback.createdAt.toISOString(),
                updatedAt: update.feedback.updatedAt.toISOString(),
                author: update.feedback.author,
              }
            : null
        }
        isAdmin={isAdmin}
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
