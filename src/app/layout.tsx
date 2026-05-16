import type { Metadata } from "next"
import { AppHeader } from "@/components/app-header"
import { ThemeProvider } from "@/components/theme-provider"
import { getCurrentUser } from "@/lib/current-user"
import "./globals.css"

export const metadata: Metadata = {
  title: "Taskpulse — 團隊任務追蹤",
  description: "組員寫進度摘要、主管針對每筆摘要 1 對 1 回饋",
}

// FOUC 防護：React hydrate 之前就把 data-theme 寫上 <html>，避免切夜間時閃白
const themeInitScript = `(function(){try{var t=localStorage.getItem("taskpulse-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Day 1：身分由 .env DEV_CURRENT_USER_ID 決定；沒設或設錯就 null，header 會顯示警告
  const user = await getCurrentUser().catch(() => null)

  return (
    <html lang="zh-Hant-TW" className="h-full" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: FOUC 防護腳本必須在 hydrate 前同步執行 */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AppHeader user={user ? { name: user.name, role: user.role } : null} />
          <main className="flex flex-1 flex-col">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
