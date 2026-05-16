import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // 鎖定 file tracing root 在這個專案，避免 Next 偵測到上層 lockfile 後誤判 workspace root
  outputFileTracingRoot: path.join(__dirname),
  // Vercel 部署：把 build 時 seed 過的 SQLite + migrations + schema 一起 bundle 進 lambda
  // runtime 由 src/lib/db.ts 將 prisma/dev.db copy 到 /tmp 後使用（/tmp 才可寫）
  outputFileTracingIncludes: {
    "/**": ["./prisma/dev.db", "./prisma/migrations/**", "./prisma/schema.prisma"],
  },
}

export default nextConfig
