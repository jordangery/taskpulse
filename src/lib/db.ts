import { PrismaClient } from "@prisma/client"

// DB 來源：純 env DATABASE_URL（dev + prod 都用 Neon Postgres）
// 早期版本用 SQLite + Vercel /tmp 拷貝的 hack，換 Neon 後已拿掉

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
