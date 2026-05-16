import { z } from "zod"

// content 1-1000 字（spec features.md 第 89 行：max 1000 字）
export const feedbackFormSchema = z.object({
  content: z.string().trim().min(1, "請填內容").max(1000, "最長 1000 字"),
})

export type FeedbackFormValues = z.infer<typeof feedbackFormSchema>

// 任務列表「快速回饋」會 auto-generate ProgressUpdate 用這個 marker 當 summary
// 之後 UI 可以辨識這類 row 並換 icon / 換顏色提示
export const ADMIN_QUICK_FEEDBACK_MARKER = "（主管快速回饋此任務）"
