// Node-only NextAuth：加上 Prisma adapter + 需要 DB 的 events
// route handler (/api/auth/[...nextauth]) 跟 server components 用這個
// Edge middleware 不准 import 這個檔（會炸 node:fs / Prisma client）→ middleware 用 auth.config.ts
import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import { prisma } from "@/lib/db"

// 型別擴充（Session.user + JWT 加 id/role）放在 auth.config.ts，這裡只負責 server-side wiring

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  events: {
    async createUser({ user }) {
      // 第一個登入的人自動成為 admin（spec features.md ## 7 line 162）
      // Seeded 環境 count 已 > 1，此分支只在 production 全新 DB 才會觸發
      const count = await prisma.user.count()
      if (count === 1) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "admin" },
        })
      }
    },
  },
})
