"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/current-user"
import { prisma } from "@/lib/db"
import {
  type CreateMemberInput,
  createMemberSchema,
  type UpdateMemberInput,
  updateMemberSchema,
} from "@/lib/schemas/user"

export type ActionResult = { success: true } | { success: false; error: string }

export async function createMember(input: CreateMemberInput): Promise<ActionResult> {
  await requireAdmin()
  const parsed = createMemberSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }
  try {
    await prisma.user.create({ data: parsed.data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "Email 已被使用" }
    }
    throw e
  }
  revalidatePath("/members")
  return { success: true }
}

export async function updateMember(id: string, input: UpdateMemberInput): Promise<ActionResult> {
  await requireAdmin()
  const parsed = updateMemberSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "驗證失敗" }
  }
  try {
    await prisma.user.update({ where: { id }, data: parsed.data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { success: false, error: "找不到該成員" }
    }
    throw e
  }
  revalidatePath("/members")
  revalidatePath(`/members/${id}/edit`)
  return { success: true }
}

// 軟刪除：archivedAt 標記為現在，不真的 DELETE（避免任務 assignee 變孤兒）
export async function archiveMember(id: string): Promise<void> {
  await requireAdmin()
  await prisma.user.update({ where: { id }, data: { archivedAt: new Date() } })
  revalidatePath("/members")
}

export async function unarchiveMember(id: string): Promise<void> {
  await requireAdmin()
  await prisma.user.update({ where: { id }, data: { archivedAt: null } })
  revalidatePath("/members")
}
