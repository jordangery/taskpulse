import Link from "next/link"
import { redirect } from "next/navigation"
import { archiveMember, unarchiveMember } from "@/lib/actions/members"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"

export default async function MembersPage() {
  // Day 1 UI 切換：member 不能進 /members（Day 2 改用 middleware 強制）
  const me = await getCurrentUser()
  if (me.role !== "admin") redirect("/")

  const users = await prisma.user.findMany({
    orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      archivedAt: true,
      createdAt: true,
    },
  })

  const active = users.filter((u) => !u.archivedAt)
  const archived = users.filter((u) => u.archivedAt)

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">成員管理</h1>
            <p className="mt-1 text-sm text-text-secondary">
              共 {active.length} 位現役成員
              {archived.length > 0 ? ` + ${archived.length} 位已封存` : ""}
            </p>
          </div>
          <Link
            href="/members/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent"
          >
            新增成員
          </Link>
        </header>

        <section className="space-y-2">
          {active.map((u) => (
            <MemberRow key={u.id} user={u} archived={false} />
          ))}
        </section>

        {archived.length > 0 && (
          <section className="mt-8 space-y-2">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-text-tertiary">已封存</h2>
            {archived.map((u) => (
              <MemberRow key={u.id} user={u} archived={true} />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

interface MemberRowProps {
  user: {
    id: string
    name: string
    email: string
    role: "admin" | "member"
    archivedAt: Date | null
  }
  archived: boolean
}

function MemberRow({ user, archived }: MemberRowProps) {
  return (
    <div
      className={`flex items-center justify-between rounded-md border border-border-subtle bg-surface px-4 py-3 ${
        archived ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-1 items-center gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">{user.name}</span>
          <span className="text-xs text-text-tertiary">{user.email}</span>
        </div>
        <RoleBadge role={user.role} />
      </div>
      <div className="flex items-center gap-2">
        {!archived && (
          <Link
            href={`/members/${user.id}/edit`}
            className="rounded-md border border-border-subtle bg-canvas px-3 py-1.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary"
          >
            編輯
          </Link>
        )}
        {archived ? (
          <form action={unarchiveMember.bind(null, user.id)}>
            <button
              type="submit"
              className="rounded-md border border-border-subtle bg-canvas px-3 py-1.5 text-xs text-text-secondary hover:bg-subtle hover:text-text-primary"
            >
              還原
            </button>
          </form>
        ) : (
          <form action={archiveMember.bind(null, user.id)}>
            <button
              type="submit"
              className="rounded-md bg-danger-subtle px-3 py-1.5 text-xs text-danger hover:bg-danger hover:text-text-inverse"
            >
              封存
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: "admin" | "member" }) {
  if (role === "admin") {
    return (
      <span className="rounded-full bg-primary-subtle px-2.5 py-0.5 text-xs text-primary">
        主管
      </span>
    )
  }
  return (
    <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs text-accent">組員</span>
  )
}
