import Link from "next/link"
import { redirect } from "next/navigation"
import { TaskForm } from "@/components/features/task-form"
import { createTask } from "@/lib/actions/tasks"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"

export default async function NewTaskPage() {
  const me = await getCurrentUser()
  if (me.role !== "admin") redirect("/tasks")

  const assignees = await prisma.user.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6">
          <Link href="/tasks" className="text-xs text-text-tertiary hover:text-text-secondary">
            ← 回任務列表
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">新增任務</h1>
        </header>
        {assignees.length === 0 ? (
          <p className="text-sm text-danger">沒有任何成員可以指派，請先去 /members 建立成員。</p>
        ) : (
          <TaskForm mode="create" action={createTask} assignees={assignees} />
        )}
      </div>
    </div>
  )
}
