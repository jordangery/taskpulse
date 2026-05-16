// Node-only NextAuth：加上 Prisma adapter + Credentials provider + 需要 DB 的 events
// route handler (/api/auth/[...nextauth]) 跟 server components 用這個
// Edge middleware 不准 import 這個檔（會炸 node:fs / Prisma client）→ middleware 用 auth.config.ts
import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/auth.config"
import { prisma } from "@/lib/db"

// 型別擴充（Session.user + JWT 加 id/role）放在 auth.config.ts，這裡只負責 server-side wiring

// 開發專用：依 email 直接 impersonate 既有 user，跳過真實 OAuth
// 不放 auth.config.ts 因為要查 Prisma → middleware Edge runtime 跑不了
// production (Vercel) 環境完全不註冊，UI 也不會出現這個 provider
const devProviders =
  process.env.NODE_ENV !== "production"
    ? [
        Credentials({
          id: "dev-impersonate",
          name: "Dev Impersonate（測試帳號）",
          credentials: {
            email: {
              label: "Email",
              type: "email",
              placeholder: "alice@taskpulse.dev",
            },
          },
          async authorize(creds) {
            // 再加一道 production 防護（多寫不會死）
            if (process.env.NODE_ENV === "production") return null
            const raw = (creds?.email as string | undefined) ?? ""
            const email = raw.toLowerCase().trim()
            if (!email) return null
            const user = await prisma.user.findUnique({ where: { email } })
            if (!user) return null
            if (user.archivedAt) return null
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              // 自訂欄位 role：jwt callback 會把它寫進 token
              role: user.role,
            } as { id: string; email: string; name: string; role: "admin" | "member" }
          },
        }),
      ]
    : []

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [...authConfig.providers, ...devProviders],
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
