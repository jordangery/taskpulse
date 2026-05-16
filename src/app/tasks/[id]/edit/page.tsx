import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { TaskForm } from "@/components/features/task-form"
import { updateTask } from "@/lib/actions/tasks"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditTaskPage({ params }: PageProps) {
  const me = await getCurrentUser()
  if (me.role !== "admin") redirect("/tasks")

  const { id } = await params
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) notFound()

  const assignees = await prisma.user.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  })

  const boundAction = updateTask.bind(null, task.id)

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6">
          <Link
            href={`/tasks/${task.id}`}
            className="text-xs text-text-tertiary hover:text-text-secondary"
          >
            ← 回任務詳情
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">編輯任務</h1>
        </header>
        <TaskForm
          mode="edit"
          action={boundAction}
          assignees={assignees}
          defaultValues={{
            title: task.title,
            description: task.description ?? "",
            assigneeId: task.assigneeId,
            dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "",
          }}
          onSuccessRedirect={`/tasks/${task.id}`}
        />
      </div>
    </div>
  )
}
