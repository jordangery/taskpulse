import type { Metadata } from "next"
import { AppHeader } from "@/components/app-header"
import { ThemeProvider } from "@/components/theme-provider"
import { fetchMyNotifications } from "@/lib/actions/notifications"
import { getCurrentUser } from "@/lib/current-user"
import "./globals.css"

export const metadata: Metadata = {
  title: "Taskpulse — 團隊任務追蹤",
  description: "組員寫進度摘要、主管針對每筆摘要 1 對 1 回饋",
}

// FOUC 防護：React hydrate 之前就把 data-theme 寫上 <html>，避免切夜間時閃白
const themeInitScript = `(function(){try{var t=localStorage.getItem("taskpulse-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // 身分：登入優先讀 NextAuth session，沒 session 走 DEV_CURRENT_USER_ID fallback
  // 抓不到就 null，header 顯示「未設定身分」
  const user = await getCurrentUser().catch(() => null)
  // 通知：登入後才抓；未登入回空殼避免在 /login 上炸 DB query
  const notifications = user ? await fetchMyNotifications().catch(() => undefined) : undefined

  return (
    <html lang="zh-Hant-TW" className="h-full" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: FOUC 防護腳本必須在 hydrate 前同步執行 */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AppHeader
            user={user ? { name: user.name, role: user.role } : null}
            notifications={notifications}
          />
          <main className="flex flex-1 flex-col">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
