import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth, { type DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import { prisma } from "@/lib/db"

// 把 user.id + user.role 加到 session.user 的型別上
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: "admin" | "member"
    } & DefaultSession["user"]
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Google 自動讀 AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET，無需顯式傳
  providers: [Google],
  // database strategy 才能搭 Prisma adapter（user.id 從 DB 拿）
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      // 把 DB User row 的 id 跟 role 灌進 session.user
      if (session.user) {
        session.user.id = user.id
        // user 是 PrismaAdapter 從 User 表拿的，已含 role
        session.user.role = (user as { role: "admin" | "member" }).role
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      // 第一個登入的人自動成為 admin（spec features.md ## 7 第 162 行）
      // 注意：seed 過的環境 count 已經 > 1，這個分支只在 production 全新 DB 才會觸發
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
