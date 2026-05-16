import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

// Vercel SQLite 暫時性策略：
//   - build 時 prisma migrate deploy + db seed 把 schema + 假資料寫進 prisma/dev.db
//   - next.config.ts outputFileTracingIncludes 把該檔 bundle 進 lambda（read-only）
//   - cold start 第一次需要 DB 時：copy 進 /tmp/dev.db（可寫）
//   - 之後讀寫都對 /tmp/dev.db
//   - 注意：lambda 冷卻或重新部署時 /tmp 會清掉，使用者新增的資料會回到 seed 狀態
function resolveDbUrl(): string {
  // Vercel runtime：process.env.VERCEL === "1"
  if (process.env.VERCEL) {
    const tmpPath = "/tmp/dev.db"
    if (!fs.existsSync(tmpPath)) {
      const bundledPath = path.join(process.cwd(), "prisma", "dev.db")
      if (fs.existsSync(bundledPath)) {
        fs.copyFileSync(bundledPath, tmpPath)
      }
      // 若 bundled 也沒有（build 出錯），fall through 讓 Prisma 自己回報缺檔
    }
    return `file:${tmpPath}`
  }
  // 本地 dev / 其他環境：用 env 設的 DATABASE_URL
  return process.env.DATABASE_URL ?? "file:./dev.db"
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDbUrl() } },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
