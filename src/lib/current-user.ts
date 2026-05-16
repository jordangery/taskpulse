// taskpulse - src/lib/current-user.ts
//
// Day 2：優先讀 NextAuth session；DEV_CURRENT_USER_ID 保留為本地 dev fallback
// （方便不開瀏覽器跑 inline tsx test，prod 上不會 set DEV_CURRENT_USER_ID 所以不會 fallback）
//
// 這個 abstraction 讓 Day 1 寫的所有 route / component 在 Day 2 不用改

import { auth } from "@/auth"
import { prisma } from "./db"

export async function getCurrentUser() {
  // 1. NextAuth session 為主
  const session = await auth()
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })
    if (user) return user
    // 有 session 但 DB 找不到（不該發生，session 跟 User 透過 PrismaAdapter 綁定）
    throw new Error(`Session user not in DB: ${session.user.email}`)
  }

  // 2. 本地 dev fallback：DEV_CURRENT_USER_ID（curl / tsx smoke test 用）
  const devId = process.env.DEV_CURRENT_USER_ID
  if (devId) {
    const user = await prisma.user.findUnique({ where: { id: devId } })
    if (!user) {
      throw new Error(`DEV_CURRENT_USER_ID points to non-existent user: ${devId}`)
    }
    return user
  }

  // 3. 都沒有：未登入
  throw new Error("Unauthorized: no session and no DEV_CURRENT_USER_ID")
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (user.role !== "admin") {
    throw new Error("Forbidden: admin only")
  }
  return user
}

export async function requireUser() {
  return getCurrentUser()
}
