// Edge-safe NextAuth config — 不含 Prisma adapter / fs / 其他 Node-only API
// middleware.ts 用這個；src/auth.ts 在這之上加 adapter + events 給 server-side 用
import type { DefaultSession, NextAuthConfig } from "next-auth"
import "next-auth/jwt"
import Atlassian from "next-auth/providers/atlassian"
import Google from "next-auth/providers/google"

// 型別擴充放這裡，讓 auth.config + auth.ts + middleware 都能用
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

// Atlassian secondary OAuth：僅當 ATLASSIAN_CLIENT_ID / SECRET 都設時才註冊
// 沒設 → graceful degradation：dashboard Jira widget 會顯示「尚未設定」訊息
// 預設 scope 是 read:me；override 為 read:jira-work / read:jira-user / offline_access (refresh_token)
// 同時加 read:me 保留 userinfo 端點正常運作
const atlassianProvider =
  process.env.ATLASSIAN_CLIENT_ID && process.env.ATLASSIAN_CLIENT_SECRET
    ? [
        Atlassian({
          clientId: process.env.ATLASSIAN_CLIENT_ID,
          clientSecret: process.env.ATLASSIAN_CLIENT_SECRET,
          authorization: {
            url: "https://auth.atlassian.com/authorize",
            params: {
              audience: "api.atlassian.com",
              scope: "read:me read:jira-work read:jira-user offline_access",
              prompt: "consent",
            },
          },
          // 已有 Google account 後加掛 Atlassian（同 email）→ link 到既有 user
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []

export const authConfig = {
  providers: [
    Google({
      // 允許首次 Google 登入直接 link 到已 seeded 的同 email user
      allowDangerousEmailAccountLinking: true,
    }),
    ...atlassianProvider,
  ],
  // JWT 策略：session 存 cookie，middleware 不必查 DB
  session: { strategy: "jwt" },
  // 自訂登入頁取代 NextAuth 預設 UI（預設 Credentials form 缺 callbackUrl，登入後會卡在 signin）
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 首次登入：user 是 PrismaAdapter 剛建的 row，把 id + role 烙進 token
      if (user) {
        token.userId = user.id
        token.role = (user as { role?: "admin" | "member" }).role ?? "member"
      }
      // 之後 admin 改 role 後可手動觸發 updateSession({ role }) 刷新 token
      if (trigger === "update" && session?.user?.role) {
        token.role = session.user.role
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
} satisfies NextAuthConfig
