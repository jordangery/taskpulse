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

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string
    role?: "admin" | "member"
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Google 自動讀 AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET，無需顯式傳
  providers: [Google],
  // JWT strategy：session 存 cookie 不查 DB
  // → middleware (Edge runtime) 可直接 decode token 不需 Prisma
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 首次登入：user 是剛建好的 DB row，把 id + role 烙進 token
      if (user) {
        token.userId = user.id
        token.role = (user as { role: "admin" | "member" }).role
      }
      // 之後 admin 改成 member（或反過來）時，前端可呼叫 updateSession({ role }) 觸發 trigger=update
      if (trigger === "update" && session?.user?.role) {
        token.role = session.user.role as "admin" | "member"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId
      }
      if (session.user && token.role) {
        session.user.role = token.role
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
