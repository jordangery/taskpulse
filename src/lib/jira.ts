// taskpulse - src/lib/jira.ts
//
// Server-only Atlassian Jira 整合
// - 每個 user 在 PrismaAdapter 的 Account row（provider="atlassian"）存 access_token / refresh_token / expires_at
// - 過期前用 refresh_token 換新的，並回寫 DB
// - 拿 token 後先打 /oauth/token/accessible-resources 拿 cloudId，再打 /ex/jira/{cloudId}/rest/api/3/search/jql
//
// 對應 taskpulse user：用 issue.fields.assignee.emailAddress 對 prisma.user.email
// match 不到就 fallback 顯示 Atlassian displayName
//
// Admin 模式（fetchTeamJiraIssues）：用「任一 admin 的 token」一條線去 Jira 撈所有 taskpulse
// 成員的票（不要求每位 member 自己連 Atlassian）。流程：對每個 member email 各打一次
// /rest/api/3/user/search 拿 accountId，再用單一 JQL `assignee in (...)` 撈完。
// 限制：admin Atlassian 要能看到組員的 Jira project；組員 email 要在同 Atlassian Cloud 組織內。

import "server-only"
import { prisma } from "./db"

const ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
const ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"
const JIRA_FIELDS = "summary,status,priority,issuetype,duedate,assignee"
const JIRA_MAX_RESULTS = 50

export interface JiraIssue {
  key: string // e.g. "PROJ-123"
  summary: string
  status: string // status.name
  priority: string | null
  issueType: string
  dueDate: string | null // YYYY-MM-DD
  url: string // browse URL
  assigneeName: string // 對應 taskpulse 名字（找不到則用 Atlassian displayName）
}

export type JiraFetchResult =
  | { kind: "not_configured" }
  | { kind: "not_connected" }
  | { kind: "error"; message: string }
  | { kind: "ok"; issues: JiraIssue[] }

interface AtlassianAccountToken {
  id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: number | null
}

interface AccessibleResource {
  id: string
  url: string
  name: string
  scopes: string[]
}

interface JiraSearchResponse {
  issues?: Array<{
    key: string
    fields: {
      summary: string
      status?: { name?: string }
      priority?: { name?: string } | null
      issuetype?: { name?: string }
      duedate?: string | null
      assignee?: {
        emailAddress?: string
        displayName?: string
      } | null
    }
  }>
}

function envConfigured(): boolean {
  return Boolean(process.env.ATLASSIAN_CLIENT_ID && process.env.ATLASSIAN_CLIENT_SECRET)
}

/**
 * 確保 access_token 仍有效；過期則用 refresh_token 換新並寫回 DB。
 * 回傳：可用的 access_token 字串 / null（取不到）
 */
async function ensureAccessToken(account: AtlassianAccountToken): Promise<string | null> {
  // 還有效（buffer 60 秒避免邊界 race）
  const nowSec = Math.floor(Date.now() / 1000)
  if (account.access_token && account.expires_at && account.expires_at > nowSec + 60) {
    return account.access_token
  }

  // 沒 refresh_token 或 env 沒設 → 無法 refresh
  if (!account.refresh_token) return null
  if (!envConfigured()) return null

  try {
    const res = await fetch(ATLASSIAN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: process.env.ATLASSIAN_CLIENT_ID,
        client_secret: process.env.ATLASSIAN_CLIENT_SECRET,
        refresh_token: account.refresh_token,
      }),
    })

    if (!res.ok) return null

    const data = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }

    if (!data.access_token) return null

    const newExpiresAt = data.expires_in ? nowSec + data.expires_in : null

    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: data.access_token,
        // Atlassian rotates refresh_token：若回傳新的就更新，否則保留舊的
        refresh_token: data.refresh_token ?? account.refresh_token,
        expires_at: newExpiresAt,
      },
    })

    return data.access_token
  } catch {
    return null
  }
}

async function fetchAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
  const res = await fetch(ATLASSIAN_RESOURCES_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`accessible-resources ${res.status}`)
  }
  return (await res.json()) as AccessibleResource[]
}

async function fetchIssuesForCloud(
  accessToken: string,
  cloudId: string,
  siteUrl: string,
  jql: string,
): Promise<JiraIssue[]> {
  // 用新版 /search/jql 端點（舊 /search 已於 2025-04 棄用，2025-05 完全移除）
  // 參考 https://developer.atlassian.com/changelog/#CHANGE-2046
  // 差異：response 用 nextPageToken 分頁（不再回 total / startAt）；request shape 相同
  const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`)
  url.searchParams.set("jql", jql)
  url.searchParams.set("fields", JIRA_FIELDS)
  url.searchParams.set("maxResults", String(JIRA_MAX_RESULTS))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`jira search ${res.status} ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as JiraSearchResponse
  const issues = data.issues ?? []

  // 預先批次撈所有 emailAddress 對應的 taskpulse user，避免每筆 issue 查一次 DB
  const emails = Array.from(
    new Set(
      issues
        .map((i) => i.fields.assignee?.emailAddress?.toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  )
  const taskpulseUsers =
    emails.length === 0
      ? []
      : await prisma.user.findMany({
          where: { email: { in: emails } },
          select: { email: true, name: true },
        })
  const emailToName = new Map(taskpulseUsers.map((u) => [u.email.toLowerCase(), u.name]))

  return issues.map((issue) => {
    const assigneeEmail = issue.fields.assignee?.emailAddress?.toLowerCase()
    const taskpulseName = assigneeEmail ? emailToName.get(assigneeEmail) : undefined
    const fallbackName = issue.fields.assignee?.displayName ?? "Unassigned"
    return {
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name ?? "Unknown",
      priority: issue.fields.priority?.name ?? null,
      issueType: issue.fields.issuetype?.name ?? "Task",
      dueDate: issue.fields.duedate ?? null,
      url: `${siteUrl.replace(/\/$/, "")}/browse/${issue.key}`,
      assigneeName: taskpulseName ?? fallbackName,
    }
  })
}

async function fetchIssuesForAccount(account: AtlassianAccountToken): Promise<JiraIssue[]> {
  const token = await ensureAccessToken(account)
  if (!token) throw new Error("無法取得有效 Atlassian access token（可能 refresh_token 已失效）")

  const resources = await fetchAccessibleResources(token)
  if (resources.length === 0) return []
  // MVP：只查第一個 cloudId（多數使用者只有一個 Atlassian site）
  const first = resources[0]
  return fetchIssuesForCloud(
    token,
    first.id,
    first.url,
    "assignee = currentUser() ORDER BY updated DESC",
  )
}

// ---------- Sync taskpulse Task → Jira issue（建立） ----------

export type JiraCreatePayload = {
  title: string
  description: string | null
  dueDate: Date | null
  assigneeEmail: string
}
export type JiraCreateResult =
  | { kind: "not_configured" }
  | { kind: "not_connected" } // 沒任何 admin 連 Atlassian
  | { kind: "ok"; issueKey: string }
  | { kind: "error"; message: string }

// 用 admin token push 一筆 task 到 Jira
// 流程：admin token → cloudId → project (取第一個 accessible) → assignee accountId → POST issue
export async function createJiraIssueFromTask(p: JiraCreatePayload): Promise<JiraCreateResult> {
  if (!envConfigured()) return { kind: "not_configured" }

  const adminAccount = await prisma.account.findFirst({
    where: { provider: "atlassian", user: { role: "admin" } },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
  })
  if (!adminAccount) return { kind: "not_connected" }

  const token = await ensureAccessToken(adminAccount)
  if (!token) return { kind: "error", message: "Admin Atlassian token 失效" }

  try {
    const resources = await fetchAccessibleResources(token)
    if (resources.length === 0)
      return { kind: "error", message: "Admin 沒任何 accessible Jira site" }
    const { id: cloudId } = resources[0]

    // 拿第一個 project key（簡單策略；多 project 之後做 settings）
    const projectKey = await fetchFirstProjectKey(token, cloudId)
    if (!projectKey) return { kind: "error", message: "Admin 看不到任何 Jira project" }

    // assignee accountId
    const assigneeAccountId = await lookupAccountId(token, cloudId, p.assigneeEmail)

    // POST /rest/api/3/issue
    const body: Record<string, unknown> = {
      fields: {
        project: { key: projectKey },
        summary: p.title,
        issuetype: { name: "Task" },
        ...(p.description
          ? {
              description: {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: p.description }],
                  },
                ],
              },
            }
          : {}),
        ...(p.dueDate ? { duedate: toJiraDateKey(p.dueDate) } : {}),
        ...(assigneeAccountId ? { assignee: { accountId: assigneeAccountId } } : {}),
      },
    }
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { kind: "error", message: `${res.status} ${text.slice(0, 300)}` }
    }
    const data = (await res.json()) as { key?: string }
    if (!data.key) return { kind: "error", message: "Jira 回應沒帶 issue key" }
    return { kind: "ok", issueKey: data.key }
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : "未知錯誤" }
  }
}

// Update existing Jira issue（PUT /rest/api/3/issue/{key}）
// 只傳變動的 field；assignee 要 email → accountId lookup
// 跟 create 一樣不丟例外，回 result 給 caller 寫 sync state
export type JiraUpdatePayload = {
  issueKey: string
  title?: string
  description?: string | null
  dueDate?: Date | null
  assigneeEmail?: string // 換人時填新人的 email
}
export type JiraUpdateResult =
  | { kind: "not_configured" }
  | { kind: "not_connected" }
  | { kind: "ok" }
  | { kind: "error"; message: string }

export async function updateJiraIssueFromTask(p: JiraUpdatePayload): Promise<JiraUpdateResult> {
  if (!envConfigured()) return { kind: "not_configured" }
  const adminAccount = await prisma.account.findFirst({
    where: { provider: "atlassian", user: { role: "admin" } },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
  })
  if (!adminAccount) return { kind: "not_connected" }
  const token = await ensureAccessToken(adminAccount)
  if (!token) return { kind: "error", message: "Admin Atlassian token 失效" }
  try {
    const resources = await fetchAccessibleResources(token)
    if (resources.length === 0)
      return { kind: "error", message: "Admin 沒任何 accessible Jira site" }
    const { id: cloudId } = resources[0]

    // 拼 fields object（只填 caller 真的有給的欄位）
    const fields: Record<string, unknown> = {}
    if (p.title !== undefined) fields.summary = p.title
    if (p.description !== undefined) {
      fields.description = p.description
        ? {
            type: "doc",
            version: 1,
            content: [{ type: "paragraph", content: [{ type: "text", text: p.description }] }],
          }
        : null
    }
    if (p.dueDate !== undefined) fields.duedate = p.dueDate ? toJiraDateKey(p.dueDate) : null
    if (p.assigneeEmail) {
      const accountId = await lookupAccountId(token, cloudId, p.assigneeEmail)
      // 找不到 accountId → 取消指派；別讓整個 update 失敗
      fields.assignee = accountId ? { accountId } : null
    }

    if (Object.keys(fields).length === 0) return { kind: "ok" } // nothing to send

    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${p.issueKey}`
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ fields }),
    })
    // Jira 回 204 No Content；非 2xx 都當失敗
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { kind: "error", message: `${res.status} ${text.slice(0, 300)}` }
    }
    return { kind: "ok" }
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : "未知錯誤" }
  }
}

// 寫一條 comment 到 Jira issue（POST /rest/api/3/issue/{key}/comment）
// body 接純字串，內部會包成 ADF（Atlassian Document Format）
// 失敗只 log 不丟例外，避免拖垮 taskpulse 原本的 progress/feedback 動作
export async function addJiraComment(issueKey: string, body: string): Promise<void> {
  if (!envConfigured()) return
  const adminAccount = await prisma.account.findFirst({
    where: { provider: "atlassian", user: { role: "admin" } },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
  })
  if (!adminAccount) return
  const token = await ensureAccessToken(adminAccount)
  if (!token) return
  try {
    const resources = await fetchAccessibleResources(token)
    if (resources.length === 0) return
    const { id: cloudId } = resources[0]
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}/comment`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: body }],
            },
          ],
        },
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => "")
      console.warn(`[jira comment] ${issueKey} failed ${res.status} ${t.slice(0, 200)}`)
    }
  } catch (err) {
    console.warn(`[jira comment] ${issueKey} threw`, err)
  }
}

// 把 Jira issue 切換到「結案」或「重開」狀態
// 因為每個 Jira project workflow 不同，沒辦法寫死 transition id
// 解法：先 GET /transitions 看現在能去哪些狀態，比對名字（done/closed/resolved 或 reopen/to do/open）
// 找到第一個 match 的 transition.id 再 POST
// 找不到任何匹配 transition → 回 error（不會悄悄沒做）
export type JiraTransitionDirection = "close" | "reopen"
export type JiraTransitionResult =
  | { kind: "not_configured" }
  | { kind: "not_connected" }
  | { kind: "ok"; transitionName: string }
  | { kind: "error"; message: string }

const CLOSE_KEYWORDS = /done|closed|resolved|complete|finish/i
const REOPEN_KEYWORDS = /reopen|to ?do|open|backlog|in progress/i

export async function transitionJiraIssue(
  issueKey: string,
  direction: JiraTransitionDirection,
): Promise<JiraTransitionResult> {
  if (!envConfigured()) return { kind: "not_configured" }
  const adminAccount = await prisma.account.findFirst({
    where: { provider: "atlassian", user: { role: "admin" } },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
  })
  if (!adminAccount) return { kind: "not_connected" }
  const token = await ensureAccessToken(adminAccount)
  if (!token) return { kind: "error", message: "Admin Atlassian token 失效" }
  try {
    const resources = await fetchAccessibleResources(token)
    if (resources.length === 0)
      return { kind: "error", message: "Admin 沒任何 accessible Jira site" }
    const { id: cloudId } = resources[0]

    // 1. 看這張 issue 現在可走的 transitions
    const listRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}/transitions`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      },
    )
    if (!listRes.ok) {
      const t = await listRes.text().catch(() => "")
      return { kind: "error", message: `transitions ${listRes.status} ${t.slice(0, 200)}` }
    }
    const list = (await listRes.json()) as {
      transitions?: Array<{ id: string; name: string; to?: { name?: string } }>
    }
    const re = direction === "close" ? CLOSE_KEYWORDS : REOPEN_KEYWORDS
    const match = list.transitions?.find(
      (t) => re.test(t.name) || (t.to?.name ? re.test(t.to.name) : false),
    )
    if (!match) {
      const avail = list.transitions?.map((t) => t.name).join(", ") ?? "(none)"
      return {
        kind: "error",
        message: `找不到對應 transition（要 ${direction}），可用：${avail}`,
      }
    }

    // 2. POST transition
    const postRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}/transitions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ transition: { id: match.id } }),
      },
    )
    if (!postRes.ok) {
      const t = await postRes.text().catch(() => "")
      return { kind: "error", message: `transition ${postRes.status} ${t.slice(0, 200)}` }
    }
    return { kind: "ok", transitionName: match.name }
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : "未知錯誤" }
  }
}

// 拿第一個 admin 看得到的 project key（簡單 MVP；多 project 環境之後加 settings 選）
async function fetchFirstProjectKey(token: string, cloudId: string): Promise<string | null> {
  const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search?maxResults=1`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) return null
  const data = (await res.json()) as { values?: Array<{ key: string }> }
  return data.values?.[0]?.key ?? null
}

// Jira API 收的是 local YYYY-MM-DD（不是 ISO 時戳）
function toJiraDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// Jira issue browse URL（給 UI 連過去用）
export async function getJiraBrowseUrl(issueKey: string): Promise<string | null> {
  if (!envConfigured()) return null
  const adminAccount = await prisma.account.findFirst({
    where: { provider: "atlassian", user: { role: "admin" } },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
  })
  if (!adminAccount) return null
  const token = await ensureAccessToken(adminAccount)
  if (!token) return null
  try {
    const resources = await fetchAccessibleResources(token)
    if (resources.length === 0) return null
    return `${resources[0].url.replace(/\/$/, "")}/browse/${issueKey}`
  } catch {
    return null
  }
}

// 給定 email，去 Jira 找對應的 accountId
// 找不到回 null（user 不在這個 Atlassian Cloud 組織 或 email 不 match）
async function lookupAccountId(
  accessToken: string,
  cloudId: string,
  email: string,
): Promise<string | null> {
  const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/user/search`)
  url.searchParams.set("query", email)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) return null
  const users = (await res.json()) as Array<{ accountId: string; emailAddress?: string }>
  // 優先 exact email match，再 fallback 第一筆
  const exact = users.find((u) => u.emailAddress?.toLowerCase() === email.toLowerCase())
  return exact?.accountId ?? users[0]?.accountId ?? null
}

/**
 * Member：撈當前 user 自己的 Jira 票
 */
export async function fetchMyJiraIssues(userId: string): Promise<JiraFetchResult> {
  if (!envConfigured()) return { kind: "not_configured" }

  const account = await prisma.account.findFirst({
    where: { userId, provider: "atlassian" },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
  })
  if (!account) return { kind: "not_connected" }

  try {
    const issues = await fetchIssuesForAccount(account)
    return { kind: "ok", issues }
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "未知錯誤",
    }
  }
}

/**
 * Admin：用「任一 admin 的 Atlassian token」查所有 taskpulse 成員的 Jira 票
 *
 * 改動於 2026-05：原本是 N+1 個 user 各自連 Atlassian 後聚合，但實務上組員不太會主動連，
 * 改成 admin token 一條線去 Jira 查所有 taskpulse member email 對應的 Jira user。
 *
 * 流程：
 * 1. 找任一 admin 的 Atlassian Account（沒有 → not_connected）
 * 2. 用該 token 打 /oauth/token/accessible-resources 拿 cloudId
 * 3. 對每個非封存 taskpulse member 的 email 各打一次 /user/search 拿 Jira accountId
 *    （找不到的 user 略過，不算錯）
 * 4. 拼 JQL `assignee in (id1,id2,...) ORDER BY updated DESC` 一次撈完
 *
 * 限制：admin 的 Atlassian 必須能看到組員的 Jira 專案；組員 email 必須在同一個
 * Atlassian Cloud 組織內找得到對應的 Jira user。否則該成員的票就出不來。
 */
export async function fetchTeamJiraIssues(): Promise<JiraFetchResult> {
  if (!envConfigured()) return { kind: "not_configured" }

  // 任一 admin（不挑特定一位，先找到的就用）
  const adminAccount = await prisma.account.findFirst({
    where: { provider: "atlassian", user: { role: "admin" } },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  })
  if (!adminAccount) return { kind: "not_connected" }

  const token = await ensureAccessToken(adminAccount)
  if (!token) {
    return { kind: "error", message: "Admin Atlassian token 失效，請重新連結" }
  }

  try {
    const resources = await fetchAccessibleResources(token)
    if (resources.length === 0) return { kind: "ok", issues: [] }
    const { id: cloudId, url: siteUrl } = resources[0]

    // 撈所有非封存 taskpulse member 的 email
    const members = await prisma.user.findMany({
      where: { archivedAt: null },
      select: { email: true, name: true },
    })
    if (members.length === 0) return { kind: "ok", issues: [] }

    // 平行對每個 email 找 Jira accountId（找不到的略過）
    const lookups = await Promise.all(members.map((m) => lookupAccountId(token, cloudId, m.email)))
    const accountIds = lookups.filter((id): id is string => Boolean(id))
    if (accountIds.length === 0) return { kind: "ok", issues: [] }

    // 一次性 JQL 撈
    const jql = `assignee in (${accountIds.map((id) => `"${id}"`).join(",")}) ORDER BY updated DESC`
    const issues = await fetchIssuesForCloud(token, cloudId, siteUrl, jql)
    return { kind: "ok", issues }
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "未知錯誤",
    }
  }
}
