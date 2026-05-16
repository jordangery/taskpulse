import Link from "next/link"
import { redirect } from "next/navigation"
import { MemberForm } from "@/components/features/member-form"
import { createMember } from "@/lib/actions/members"
import { getCurrentUser } from "@/lib/current-user"

export default async function NewMemberPage() {
  const me = await getCurrentUser()
  if (me.role !== "admin") redirect("/")

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6">
          <Link href="/members" className="text-xs text-text-tertiary hover:text-text-secondary">
            ← 回成員列表
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">新增成員</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Day 1 直接建檔，Day 2 後新成員會自己 Google 登入後再由 admin 改 role
          </p>
        </header>
        <MemberForm mode="create" action={createMember} />
      </div>
    </div>
  )
}
