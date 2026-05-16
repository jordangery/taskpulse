import { DashboardAdmin } from "@/components/features/dashboard-admin"
import { DashboardMember } from "@/components/features/dashboard-member"
import { getCurrentUser } from "@/lib/current-user"

export default async function Home() {
  const me = await getCurrentUser()
  if (me.role === "admin") return <DashboardAdmin />
  return <DashboardMember user={{ id: me.id, name: me.name }} />
}
