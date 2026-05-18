"use server"

// 日曆記事 CRUD server actions
// 權限：
//   create: 任何登入 user
//   update: 只有 author 自己（admin 也不能改別人的，比照 Feedback）
//   delete: author 自己 OR admin

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"

export type NoteActionResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string }

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CONTENT_MAX = 500

const noteSchema = z.object({
  dateKey: z.string().regex(DATE_KEY_PATTERN, "日期格式錯誤"),
  content: z.string().trim().min(1, "內容必填").max(CONTENT_MAX, `不能超過 ${CONTENT_MAX} 字`),
})

export async function createCalendarNote(input: {
  dateKey: string
  content: string
}): Promise<NoteActionResult> {
  const me = await getCurrentUser()
  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }
  const note = await prisma.calendarNote.create({
    data: {
      dateKey: parsed.data.dateKey,
      content: parsed.data.content,
      authorId: me.id,
    },
  })
  revalidatePath("/")
  revalidatePath(`/calendar/${parsed.data.dateKey}`)
  return { success: true, data: { id: note.id } }
}

export async function updateCalendarNote(
  id: string,
  input: { content: string },
): Promise<NoteActionResult> {
  const me = await getCurrentUser()
  const existing = await prisma.calendarNote.findUnique({ where: { id } })
  if (!existing) return { success: false, error: "找不到該記事" }
  if (existing.authorId !== me.id) {
    return { success: false, error: "只有作者能編輯自己的記事" }
  }
  const parsed = z
    .object({
      content: z.string().trim().min(1, "內容必填").max(CONTENT_MAX, `不能超過 ${CONTENT_MAX} 字`),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }
  await prisma.calendarNote.update({
    where: { id },
    data: { content: parsed.data.content },
  })
  revalidatePath("/")
  revalidatePath(`/calendar/${existing.dateKey}`)
  return { success: true, data: { id } }
}

export async function deleteCalendarNote(id: string): Promise<void> {
  const me = await getCurrentUser()
  const existing = await prisma.calendarNote.findUnique({ where: { id } })
  if (!existing) return
  // author 或 admin 都可刪
  if (existing.authorId !== me.id && me.role !== "admin") {
    throw new Error("沒有權限刪除這則記事")
  }
  await prisma.calendarNote.delete({ where: { id } })
  revalidatePath("/")
  revalidatePath(`/calendar/${existing.dateKey}`)
}
