// Edge middleware — 只能 import auth.config（不含 Prisma adapter / fs）

import { NextResponse } from "next/server"
import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

const { auth } = NextAuth(authConfig)

// admin-only 整段
const ADMIN_PREFIXES = ["/members", "/reports"] as const
// admin-only 寫入入口
function isAdminWritePath(pathname: string): boolean {
  if (pathname === "/tasks/new") return true
  if (/^\/tasks\/[^/]+\/edit$/.test(pathname)) return true
  if (pathname === "/api/export") return true
  return false
}

function isAdminOnly(pathname: string): boolean {
  if (ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true
  return isAdminWritePath(pathname)
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl
  const isAuthed = !!req.auth
  const isAdmin = req.auth?.user?.role === "admin"

  // 沒登入：踢到自訂登入頁，帶 callbackUrl 回原本要去的頁
  if (!isAuthed) {
    const signinUrl = new URL("/login", req.url)
    signinUrl.searchParams.set("callbackUrl", `${pathname}${search}`)
    return NextResponse.redirect(signinUrl)
  }

  // 已登入但不是 admin、卻訪問 admin-only 路由：踢回首頁
  if (isAdminOnly(pathname) && !isAdmin) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
})

export const config = {
  // 排除 Next 內部 assets + favicon + NextAuth 自家路由 + 自訂登入頁本身
  // /login 必須公開（middleware redirect 目標就是它，不能再被擋回去 → infinite loop）
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/auth|login).*)"],
}
