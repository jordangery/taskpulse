// taskpulse - src/app/api/jira/connect/route.ts
//
// Phase D - Atlassian secondary OAuth 入口
// 從 dashboard 的 "Connect Atlassian" 表單 POST 過來
//
// 用 NextAuth v5 server signIn() 直接 kick off OAuth，避免被自訂 /login 攔截
// （我們 auth.config.ts 設了 pages.signIn = "/login"，那頁只放 Google + dev-impersonate
//  → 不能讓 NextAuth 走預設 signin page）

import { signIn } from "@/auth"

export async function POST() {
  await signIn("atlassian", { redirectTo: "/" })
}
