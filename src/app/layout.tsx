import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "Taskpulse — 團隊任務追蹤",
  description: "組員寫進度摘要、主管針對每筆摘要 1 對 1 回饋",
}

// FOUC 防護：React hydrate 之前就把 data-theme 寫上 <html>，避免切夜間時閃白
const themeInitScript = `(function(){try{var t=localStorage.getItem("taskpulse-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW" className="h-full" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: FOUC 防護腳本必須在 hydrate 前同步執行 */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
