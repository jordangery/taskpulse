"use server"

// 通用 refresh server actions
// 給 client 的 RefreshButton 用：呼叫後會 invalidate RSC cache，下次 fetch 強制重撈
//
// revalidatePath("/", "layout") 比單純 router.refresh() 強：
//   - router.refresh: 只是叫 Next 重 fetch RSC payload，但若 fetch 結果 hash 相同會被去重
//   - revalidatePath layout: 把整個 route tree 的 RSC cache 標記過期，下次 render 一定重跑 server

import { revalidatePath } from "next/cache"

export async function revalidateDashboard() {
  revalidatePath("/", "layout")
}
