import { z } from "zod"

export const roleSchema = z.enum(["admin", "member"])
export type Role = z.infer<typeof roleSchema>

// 新增成員：name + email + role
export const createMemberSchema = z.object({
  name: z.string().trim().min(1, "請填名稱").max(50, "最長 50 字"),
  email: z.string().trim().toLowerCase().email("Email 格式不對").max(100, "最長 100 字"),
  role: roleSchema,
})
export type CreateMemberInput = z.infer<typeof createMemberSchema>

// 編輯成員：只改 name + role（email 不允許改，避免破壞登入身分）
export const updateMemberSchema = z.object({
  name: z.string().trim().min(1, "請填名稱").max(50, "最長 50 字"),
  role: roleSchema,
})
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
