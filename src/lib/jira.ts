// taskpulse - src/lib/jira.ts
//
// Server-only Atlassian Jira 整合
// - 每個 user 在 PrismaAdapter 的 Account row（provider="atlassian"）存 access_token / refresh_token / expires_at
// - 過期前用 refresh_token 換新的，並回寫 DB
// - 拿 token 後先打 /oauth/token/accessible-resources 拿 cloudId，再打 /ex/jira/{cloudId}/rest/api/3/search
//
// 對應 taskpulse user：用 issue.fields.assignee.emailAddress 對 prisma.user.email
// match 不到就 fallback 顯示 Atlassian displayName
//
// Admin 模式（fetchTeamJiraIssues）：N+1 API calls（每位 connected user 各打一次）
// MVP 階段沒做 dedupe / cache，trade-off 是團隊大時延遲線性成長；之後可加 in-memory cache
// 或 server-side react cache

import "server-only"
import { prisma } from "./db"

const ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
const ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"
// 把搜尋限縮在 "open"-ish issue：assignee=currentUser() 已經很窄，不再加 status 條件
const JIRA_JQL = "assignee = currentUser() ORDER BY updated DESC"
const JIRA_FIELDS = "summary,status,priority,issuetype,duedate,assignee"
const JIRA_MAX_RESULTS = 25

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
): Promise<JiraIssue[]> {
  const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`)
  url.searchParams.set("jql", JIRA_JQL)
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
  return fetchIssuesForCloud(token, first.id, first.url)
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
 * Admin：聚合所有 connected user 的 Jira 票
 * 注意：N+1 API calls（每位 connected user 各打一次 accessible-resources + search）
 * 單一 user 失敗不會中斷其他 user，但會把錯誤訊息收集起來
 */
export async function fetchTeamJiraIssues(): Promise<JiraFetchResult> {
  if (!envConfigured()) return { kind: "not_configured" }

  const accounts = await prisma.account.findMany({
    where: { provider: "atlassian" },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      user: { select: { name: true } },
    },
  })

  if (accounts.length === 0) return { kind: "not_connected" }

  // 平行抓所有 user 的 issues；個別失敗不影響整體
  const results = await Promise.allSettled(accounts.map((a) => fetchIssuesForAccount(a)))

  const issues: JiraIssue[] = []
  const errors: string[] = []
  results.forEach((r, idx) => {
    const accountUserName = accounts[idx]?.user?.name ?? "unknown"
    if (r.status === "fulfilled") {
      issues.push(...r.value)
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
      errors.push(`${accountUserName}: ${msg}`)
    }
  })

  // De-dupe by key（同一張票可能多人都看得到）
  const seen = new Set<string>()
  const uniqueIssues = issues.filter((i) => {
    if (seen.has(i.key)) return false
    seen.add(i.key)
    return true
  })

  // 全部都失敗 → 視為 error
  if (uniqueIssues.length === 0 && errors.length > 0) {
    return { kind: "error", message: errors.join("; ") }
  }

  return { kind: "ok", issues: uniqueIssues }
}
