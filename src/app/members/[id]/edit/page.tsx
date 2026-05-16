import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { MemberForm } from "@/components/features/member-form"
import { updateMember } from "@/lib/actions/members"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditMemberPage({ params }: PageProps) {
  const me = await getCurrentUser()
  if (me.role !== "admin") redirect("/")

  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) notFound()

  const boundAction = updateMember.bind(null, user.id)

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6">
          <Link href="/members" className="text-xs text-text-tertiary hover:text-text-secondary">
            ← 回成員列表
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">編輯成員</h1>
          <p className="mt-1 text-sm text-text-secondary">Email 不可更改（與登入身分綁定）</p>
        </header>
        <MemberForm
          mode="edit"
          action={boundAction}
          email={user.email}
          defaultValues={{ name: user.name, role: user.role }}
        />
      </div>
    </div>
  )
}
