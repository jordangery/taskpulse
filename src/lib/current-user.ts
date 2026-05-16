// taskpulse - src/lib/current-user.ts
//
// Day 1：從 env 讀 hardcoded ID（方便快速切換身分測試）
// Day 2：改成從 NextAuth session 讀
//
// 這個 abstraction 讓 Day 1 寫的所有 route / component 在 Day 2 不用改

import { prisma } from "./db"

// ----- Day 1 版本 -----
export async function getCurrentUser() {
  const id = process.env.DEV_CURRENT_USER_ID
  if (!id) {
    throw new Error("DEV_CURRENT_USER_ID not set in .env")
  }
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    throw new Error(`DEV_CURRENT_USER_ID points to non-existent user: ${id}`)
  }
  return user
}

// ----- Day 2 版本（替換上面整個函數） -----
//
// import { auth } from "@/auth"
//
// export async function getCurrentUser() {
//   const session = await auth()
//   if (!session?.user?.email) return null
//   return prisma.user.findUnique({
//     where: { email: session.user.email },
//   })
// }

// ----- helper -----

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") {
    throw new Error("Forbidden: admin only")
  }
  return user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }
  return user
}
