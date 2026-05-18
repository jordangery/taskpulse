"use server"

// 事件 CRUD server actions
// 權限：
//   create: 任何登入 user
//   update: creator OR admin
//   delete: creator OR admin
//
// 日期：UI 送上來是 YYYY-MM-DD（local），這邊組成 local 零點 Date 存入

import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import { type EventFormValues, eventFormSchema } from "@/lib/schemas/event"

export type EventActionResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string }

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseLocalMidnight(dateKey: string): Date | null {
  const m = dateKey.match(DATE_KEY_PATTERN)
  if (!m) return null
  const [y, mo, d] = dateKey.split("-").map(Number)
  const date = new Date(y, mo - 1, d, 0, 0, 0, 0)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

export async function createEvent(input: EventFormValues): Promise<EventActionResult> {
  const me = await getCurrentUser()
  const parsed = eventFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }
  const start = parseLocalMidnight(parsed.data.startDateKey)
  const end = parseLocalMidnight(parsed.data.endDateKey)
  if (!start || !end) return { success: false, error: "日期不存在" }

  const created = await prisma.event.create({
    data: {
      title: parsed.data.title,
      description:
        parsed.data.description && parsed.data.description.length > 0
          ? parsed.data.description
          : null,
      startDate: start,
      endDate: end,
      creatorId: me.id,
      participants: {
        create: parsed.data.participantIds.map((userId) => ({ userId })),
      },
    },
  })
  revalidatePath("/")
  revalidatePath(`/calendar/${parsed.data.startDateKey}`)
  return { success: true, data: { id: created.id } }
}

export async function updateEvent(id: string, input: EventFormValues): Promise<EventActionResult> {
  const me = await getCurrentUser()
  const existing = await prisma.event.findUnique({ where: { id } })
  if (!existing) return { success: false, error: "找不到該事件" }
  if (existing.creatorId !== me.id && me.role !== "admin") {
    return { success: false, error: "只有建立者 / admin 可以編輯" }
  }
  const parsed = eventFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }
  const start = parseLocalMidnight(parsed.data.startDateKey)
  const end = parseLocalMidnight(parsed.data.endDateKey)
  if (!start || !end) return { success: false, error: "日期不存在" }

  await prisma.$transaction([
    prisma.event.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description:
          parsed.data.description && parsed.data.description.length > 0
            ? parsed.data.description
            : null,
        startDate: start,
        endDate: end,
      },
    }),
    prisma.eventParticipant.deleteMany({ where: { eventId: id } }),
    prisma.eventParticipant.createMany({
      data: parsed.data.participantIds.map((userId) => ({ eventId: id, userId })),
    }),
  ])
  revalidatePath("/")
  revalidatePath(`/calendar/${parsed.data.startDateKey}`)
  return { success: true, data: { id } }
}

export async function deleteEvent(id: string): Promise<void> {
  const me = await getCurrentUser()
  const existing = await prisma.event.findUnique({ where: { id } })
  if (!existing) return
  if (existing.creatorId !== me.id && me.role !== "admin") {
    throw new Error("沒有權限刪除這個事件")
  }
  await prisma.event.delete({ where: { id } })
  revalidatePath("/")
}
