// taskpulse - prisma/seed.ts
// 跑法：npx prisma db seed

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Idempotent guard：如果已經有 seeded 過（找得到 Jordan），直接跳出、不重 seed
  // 避免每次 npm run build 都把使用者真實寫的 task/update/feedback 洗掉
  // 要強制重 seed 改用：npx prisma migrate reset
  const existing = await prisma.user.findFirst({ where: { name: "Jordan" } })
  if (existing) {
    console.log("✓ Seed skipped — Jordan already exists (use `prisma migrate reset` to wipe)")
    return
  }

  // 1 個 admin（Jordan）+ 3 個 member
  // admin email 設成 Jordan 真實登入用的 Google 帳號，讓 PrismaAdapter 直接 link 上既有 row
  const admin = await prisma.user.create({
    data: {
      email: "jordan@geryon.net",
      name: "Jordan",
      role: "admin",
    },
  })

  const alice = await prisma.user.create({
    data: { email: "alice@taskpulse.dev", name: "Alice", role: "member" },
  })

  const bob = await prisma.user.create({
    data: { email: "bob@taskpulse.dev", name: "Bob", role: "member" },
  })

  const carol = await prisma.user.create({
    data: { email: "carol@taskpulse.dev", name: "Carol", role: "member" },
  })

  // 範例任務
  const task1 = await prisma.task.create({
    data: {
      title: "完成 Q2 銷售報表",
      description: "整合各區數據 + 圖表",
      assigneeId: alice.id,
      creatorId: admin.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  await prisma.task.create({
    data: {
      title: "產品上架審核流程",
      assigneeId: bob.id,
      creatorId: admin.id,
    },
  })

  await prisma.task.create({
    data: {
      title: "客服 SOP 更新",
      assigneeId: carol.id,
      creatorId: admin.id,
    },
  })

  // 範例進度更新（驗證 append-only 流程）
  const update1 = await prisma.progressUpdate.create({
    data: {
      taskId: task1.id,
      authorId: alice.id,
      summary: "已完成 North 區資料整合，South 區資料還在等對方提供",
      percentage: 40,
      status: "進行中",
    },
  })

  await prisma.progressUpdate.create({
    data: {
      taskId: task1.id,
      authorId: alice.id,
      summary: "South 區資料拿到了，正在做整合，預計明天能完成全部",
      percentage: 70,
      status: "進行中",
    },
  })

  // 範例回饋（驗證 1對1）
  await prisma.feedback.create({
    data: {
      progressUpdateId: update1.id,
      authorId: admin.id,
      content: "South 區可以直接打給 Mike，他手上應該有上週的版本",
    },
  })

  console.log("✓ Seed completed")
  console.log(`  Admin (Jordan): ${admin.id}`)
  console.log(`  Members: Alice=${alice.id}, Bob=${bob.id}, Carol=${carol.id}`)
  console.log("\n  把 admin id 填到 .env 的 DEV_CURRENT_USER_ID")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
