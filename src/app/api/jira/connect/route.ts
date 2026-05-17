// taskpulse - src/app/api/jira/connect/route.ts
//
// Phase D - Atlassian secondary OAuth 入口
// 從 dashboard 的 "Connect Atlassian" 表單 POST 過來
// 直接 redirect 到 NextAuth 的 signin 端點（避免 NextAuth signIn() 在 route handler 內的 redirect 異常）
//
// 注意：env 沒設 Atlassian provider 時，NextAuth signin endpoint 會回 error，
// 但我們在 widget 那邊已先攔到 not_configured，這 route 走不到該分支

import { redirect } from "next/navigation"

export async function POST() {
  redirect("/api/auth/signin/atlassian?callbackUrl=/")
}
