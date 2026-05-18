// taskpulse - prisma/seed.ts
// 跑法：npx prisma db seed
//
// 只 seed 一個 admin（Jordan）讓 PrismaAdapter 在首次 Google 登入時能 link 上既有 row。
// 不再 seed 假成員 / 範例 task / 範例 progress / 範例 feedback —— 那些測試資料已從 DB 清掉，
// 真實成員透過 `/members/new` 或直接寫 DB 加入（email 對應 Atlassian 帳號才撈得到 Jira 票）。
//
// 強制重 seed：`npx prisma migrate reset`

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Idempotent guard：找到 Jordan 就跳出，不重新塞
  const existing = await prisma.user.findFirst({ where: { email: "jordan@geryon.net" } })
  if (existing) {
    console.log("✓ Seed skipped — Jordan already exists (use `prisma migrate reset` to wipe)")
    return
  }

  const admin = await prisma.user.create({
    data: {
      email: "jordan@geryon.net",
      name: "Jordan",
      role: "admin",
    },
  })

  console.log("✓ Seed completed (admin only)")
  console.log(`  Admin (Jordan): ${admin.id}`)
  console.log("  其他成員請用 /members/new 加入，或直接寫 DB")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
