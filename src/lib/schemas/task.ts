import { z } from "zod"

// 表單欄位的 raw 型別：dueDate 是 "YYYY-MM-DD" 或空字串、description 是字串或空字串
// 不在 Zod 做 transform，避免 RHF 的 input/output 型別不一致
// 字串 → null/Date 的轉換放在 action 裡手動處理
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "請填標題").max(120, "最長 120 字"),
  description: z.string().trim().max(1000, "最長 1000 字").optional(),
  assigneeId: z.string().min(1, "請選擇 assignee"),
  dueDate: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), { message: "日期格式不對" }),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>
