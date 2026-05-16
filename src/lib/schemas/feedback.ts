import { z } from "zod"

// content 1-1000 字（spec features.md 第 89 行：max 1000 字）
export const feedbackFormSchema = z.object({
  content: z.string().trim().min(1, "請填內容").max(1000, "最長 1000 字"),
})

export type FeedbackFormValues = z.infer<typeof feedbackFormSchema>
