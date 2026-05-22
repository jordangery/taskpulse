// 救援域名 Deeplink 落地頁部署紀錄（測試環境）
// 跟世盃 Vegas 風形成對比 → SRE / 終端機 / 暗綠 / 等寬字
// 這頁不接 DB、純記錄 2026/5/22 部署到 Vercel 的兩個 *.vercel.app URL

import Link from "next/link"

export const metadata = {
  title: "Rescue Deeplink Deploy · taskpulse",
  description: "救援域名 Deeplink 落地頁部署紀錄（測試環境）",
}

interface BrandDeploy {
  brand: "BB" | "YY"
  appName: string
  scheme: string
  url: string
  rescueDomain: string
  accent: string
}

const DEPLOYS: BrandDeploy[] = [
  {
    brand: "BB",
    appName: "BBSport",
    scheme: "bbsport://",
    url: "https://rescue-bb.vercel.app",
    rescueDomain: "m-bfry6yca7c.vbra16qmlo83.com:8098",
    accent: "#00FF88",
  },
  {
    brand: "YY",
    appName: "易游體育",
    scheme: "ysport://",
    url: "https://rescue-yy.vercel.app",
    rescueDomain: "m-x7k3q9vn.xvra40qkbn88.com:8099",
    accent: "#FFA500",
  },
]

const VERIFY_CHECKS = [
  { label: "HTTPS 200", status: "PASS" as const },
  { label: "<title> + .logo 顯示品牌名", status: "PASS" as const },
  { label: "RESCUE_DOMAIN 寫入正確", status: "PASS" as const },
  { label: "Deeplink scheme 正確 (bbsport:// / ysport://)", status: "PASS" as const },
  { label: "isValidDomain 邏輯：拒絕含 :// 的值（程式碼審）", status: "PASS" as const },
  { label: "瀏覽器手動測：紅字「系統設定有誤」", status: "TODO" as const },
]

export default function RescueDeeplinkPage() {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto px-6 py-10 font-mono"
      style={{
        background: "#0a0e0d",
        color: "#cfeadd",
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.025) 2px, rgba(0,255,136,0.025) 4px)",
      }}
    >
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Back */}
        <Link
          href="/events"
          className="inline-block text-xs tracking-wider text-emerald-400 transition hover:text-emerald-300"
        >
          ← back to /events
        </Link>

        {/* Header */}
        <header className="border-l-4 border-emerald-500 pl-4">
          <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400/70">
            $ taskpulse · deploy log · 2026-05-22
          </p>
          <h1 className="mt-2 text-2xl font-bold text-emerald-200 md:text-3xl">
            救援域名 Deeplink 落地頁部署
          </h1>
          <p className="mt-1 text-sm text-emerald-400/60">
            BB + YY 兩品牌 · iOS 救援機制的靜態落地頁 · 部署到 Vercel
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-widest text-amber-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            TEST DEPLOYMENT · *.vercel.app
          </div>
        </header>

        {/* Deployed URLs */}
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-emerald-400/70">
            ## deployed_urls
          </h2>
          <div className="space-y-3">
            {DEPLOYS.map((d) => (
              <article
                key={d.brand}
                className="rounded border border-emerald-700/30 bg-black/40 p-4"
                style={{ borderLeftWidth: "3px", borderLeftColor: d.accent }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-bold" style={{ color: d.accent }}>
                    {d.brand} · {d.appName}
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400/60">
                    scheme: {d.scheme}
                  </span>
                </div>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block break-all rounded bg-black/50 px-3 py-2 text-sm text-cyan-300 underline decoration-cyan-700 underline-offset-2 transition hover:bg-black/70 hover:text-cyan-200"
                >
                  {d.url}
                </a>
                <dl className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-[140px_1fr]">
                  <dt className="text-emerald-400/60">RESCUE_DOMAIN</dt>
                  <dd className="break-all text-emerald-100">{d.rescueDomain}</dd>
                  <dt className="text-emerald-400/60">Button href (runtime)</dt>
                  <dd className="break-all text-emerald-100/80">
                    {d.scheme}Url?domain={d.rescueDomain.replace(":", "%3A")}
                  </dd>
                </dl>
              </article>
            ))}
          </div>
        </section>

        {/* Verification */}
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-emerald-400/70">
            ## verification
          </h2>
          <ul className="space-y-1.5 rounded border border-emerald-700/30 bg-black/40 p-4 text-sm">
            {VERIFY_CHECKS.map((c) => (
              <li key={c.label} className="flex items-baseline gap-2">
                <span className={c.status === "PASS" ? "text-emerald-400" : "text-amber-400"}>
                  {c.status === "PASS" ? "[✓]" : "[ ]"}
                </span>
                <span className="text-emerald-100">{c.label}</span>
                <span
                  className={
                    c.status === "PASS"
                      ? "ml-auto text-[10px] text-emerald-400/60"
                      : "ml-auto text-[10px] text-amber-400/80"
                  }
                >
                  {c.status === "PASS" ? "PASS" : "MANUAL"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Manual test recipe */}
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-emerald-400/70">
            ## dev_manual_test
          </h2>
          <div className="rounded border border-emerald-700/30 bg-black/40 p-4 text-xs">
            <p className="mb-2 text-emerald-100/80">
              在 iOS device / simulator 開上面任一個 URL，預期看到品牌 logo +
              金色「立即恢復連線」按鈕。點按鈕 → app 應收到 Universal Link：
            </p>
            <pre className="overflow-x-auto rounded bg-black/60 p-3 text-cyan-300">
              {`bbsport://Url?domain=m-bfry6yca7c.vbra16qmlo83.com%3A8098
ysport://Url?domain=m-x7k3q9vn.xvra40qkbn88.com%3A8099`}
            </pre>
            <p className="mt-3 text-emerald-100/70">
              想看「壞值」的紅字保護：把 URL 改成本地修改後重新部署、把 RESCUE_DOMAIN 改成{" "}
              <code className="text-amber-300">https://test.com</code> 預期出現{" "}
              <span className="text-red-400">「系統設定有誤，請聯絡客服」</span>
              、按鈕灰掉不可點。
            </p>
          </div>
        </section>

        {/* Important reminder */}
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-amber-400/80">
            ## !! production_warning
          </h2>
          <div className="rounded border border-amber-500/50 bg-amber-500/5 p-4 text-sm text-amber-100">
            <p>
              這次的 <code className="text-amber-300">*.vercel.app</code> URL{" "}
              <strong className="text-amber-200">只限開發 / 內部測試</strong>
              。正式上線必須：
            </p>
            <ul className="mt-2 list-inside list-decimal space-y-1 text-amber-100/80">
              <li>
                從第三方註冊商買 root domain（跟業務雲商
                <span className="text-amber-300"> 完全隔離</span>）
              </li>
              <li>綁到 Vercel custom domain，不要用任何業務雲商提供的 DNS</li>
              <li>客服 SOP / SLS 監控 / 自動切換警報 → 另一個工作流，SRE 負責</li>
            </ul>
          </div>
        </section>

        {/* Reference */}
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-emerald-400/70">
            ## references
          </h2>
          <ul className="space-y-1 rounded border border-emerald-700/30 bg-black/40 p-4 text-xs text-emerald-100/70">
            <li>
              <span className="text-emerald-400/60">spec:</span>{" "}
              <code>
                bbsport-new/docs/superpowers/specs/2026-05-20-rescue-deeplink-domain-design.md
              </code>
            </li>
            <li>
              <span className="text-emerald-400/60">readme:</span>{" "}
              <code>bbsport-new/docs/rescue-landing/README.md</code>
            </li>
            <li>
              <span className="text-emerald-400/60">runbook:</span>{" "}
              <code>~/Desktop/rescue-deeplink-sre-deployment-runbook.md</code>
            </li>
          </ul>
        </section>

        <footer className="border-t border-emerald-700/30 pt-4 text-center text-[10px] uppercase tracking-widest text-emerald-400/40">
          taskpulse · internal deployment log · 2026-05-22
        </footer>
      </div>
    </div>
  )
}
