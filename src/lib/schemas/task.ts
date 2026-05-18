import { z } from "zod"

// 表單欄位的 raw 型別：dueDate 是 "YYYY-MM-DD" 或空字串、description 是字串或空字串
// 不在 Zod 做 transform，避免 RHF 的 input/output 型別不一致
// 字串 → null/Date 的轉換放在 action 裡手動處理
//
// assigneeIds 是 user id 陣列，至少要有 1 個（第一位視為 primary、Jira sync 時用）
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "請填標題").max(120, "最長 120 字"),
  description: z.string().trim().max(1000, "最長 1000 字").optional(),
  assigneeIds: z.array(z.string().min(1)).min(1, "至少選一位 assignee"),
  dueDate: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), { message: "日期格式不對" }),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>
