# Taskpulse Design Doc

- **Status**: Approved 2026-05-16
- **Codename**: taskpulse
- **Owner**: Jordan
- **Sources of truth**:
  - Skill: `~/.claude/skills/taskpulse/` (SKILL.md + references/ + templates/)
  - Original spec / Kickoff Prompt: `~/Documents/taskpulse-source/files/taskpulse-spec.md`

This doc is the brainstorming-output synthesis. The detailed schema, features, color
tokens, and AI collaboration rules live in the skill above — do not duplicate them
here. This file records the design decisions reached during the `/brainstorming`
session and serves as the entry point for the implementation plan.

---

## Problem

Jordan (an admin) and 3 members need a low-friction way for the team to push tasks
forward by writing free-form progress summaries, and for Jordan to leave precise
feedback tied to individual progress entries (not to whole tasks). The result is a
two-day MVP: a local-only version on Day 1, with Google auth + deployment on Day 2.

## Goals

- A Next.js 15 + TypeScript + Tailwind v4 + Prisma + SQLite app.
- Day 1 (5–7.5h): theme-aware UI, member CRUD, task CRUD, append-only progress
  updates, 1:1 admin feedback per update, basic dashboard.
- Day 2 (3–6h): NextAuth v5 Google sign-in, role middleware, admin-only report
  page, JSON export, Vercel deployment.
- Eye-friendly warm color system (warm cream day / dark blue-grey night) with
  three-way theme toggle (system / light / dark) and no FOUC.

## Non-goals (this MVP)

- Editing or deleting old progress updates (append-only).
- Feedback attached directly to tasks (must go via a ProgressUpdate).
- Tags, priorities, subtasks, multi-assignee, drag-and-drop.
- Email notifications, password auth, avatar uploads.
- AI-generated report summaries, PDF/CSV export.

## Inviolable constraints

1. **ProgressUpdate is append-only.** No edit/delete on old rows; no `status`
   sync column on `Task`. "Latest state" = newest ProgressUpdate by `createdAt`.
2. **Feedback is 1:1 with ProgressUpdate.** `Feedback.progressUpdateId @unique`.
   Feedback never attaches to a `Task` directly.
3. **All colors go through CSS tokens.** No `bg-white` / `bg-black` /
   `bg-gray-*` / `text-black` / hardcoded hex. Recharts colors read from
   `--chart-1`–`--chart-5` via `getComputedStyle`. Inline `<head>` script
   prevents FOUC.

## Architecture (delta from skill defaults)

The skill's `references/architecture.md` is authoritative. Items decided during
brainstorming that override or supplement it:

- **Next.js version**: pinned to `^15` (latest stable 15.x) per spec, not the
  current default `latest` (which would bring Next 16 with breaking changes).
- **Working directory**: `/Users/user/Documents/進度觀測站/` (in-place
  scaffold). Project name in `package.json` is `taskpulse` (scaffolded in a
  temp dir then synced in, because npm rejected the Chinese folder name).
- **Node**: `.nvmrc=20`; every shell command sources `~/.nvm/nvm.sh && nvm use`
  to pick up `v20.19.4` without touching the global default.
- **Linter/formatter**: Biome (replaces ESLint+Prettier per spec), 2-space
  indent / 100 col / double-quote / semicolons-as-needed to match the
  scaffolded files.

## Day 1 plan (this session's scope)

11 commits target, paused after each step for review per Jordan's request:

| Step | Substance | Expected commits |
| --- | --- | --- |
| 1 | Next.js 15 + TS + Tailwind v4 + Biome scaffold, .nvmrc, .gitignore | `chore: initial commit with next.js scaffold` |
| 2 | Design system: globals.css tokens, ThemeProvider, ThemeToggle, layout FOUC inline script | `style: add design system tokens (light + dark)` → `feat: add theme provider + toggle (system/light/dark)` |
| 3 | Prisma + SQLite, schema (all four tables including NextAuth tables for Day 2), seed | `chore: add prisma + sqlite setup` → `db: create user/task/progressUpdate/feedback schema` |
| 4 | Member CRUD with hardcoded current user via `DEV_CURRENT_USER_ID` | `feat: add member CRUD with hardcoded current user` |
| 5 | Task CRUD (admin can write, member read-only on assigned tasks) | `feat: add task CRUD (admin only for write)` |
| 6 | Progress update append flow on task detail page | `feat: add progress update append flow` |
| 7 | 1:1 admin feedback inline on each ProgressUpdate | `feat: add admin feedback on progress update (1:1)` |
| 8 | Dashboard charts: per-person task count + weekly update frequency | `feat: add dashboard with recharts` + `style: polish task detail page` |

Day 1 acceptance: switch to Alice via `.env`, write a progress update; switch
back to Jordan, write feedback; open dashboard, see counts; toggle theme,
verify no flash.

## Day 2 plan (separate session)

NextAuth v5 + Google → role middleware → admin-only `/reports` → JSON export →
Vercel deploy. SQLite-on-Vercel decision deferred to that session.

## Risks (worth flagging)

- **SQLite on Vercel** does not persist across cold starts. Day 2 will likely
  switch to Turso (sqlite-compatible, minimal schema change) — flagged in
  `references/deployment.md`.
- **Prisma binary targets** must include `rhel-openssl-3.0.x` before deploy.
- **NextAuth callback URLs** differ between local and Vercel; both need to be
  added to the Google Cloud Console redirect-URI allowlist.

## Implementation plan

The existing skill (`~/.claude/skills/taskpulse/`) contains the detailed
step-by-step plan (Day 1 acceptance criteria per feature, commit-sequence
template, debug runbook). This session will execute Day 1 steps 1–3 first and
pause for review after each step.
