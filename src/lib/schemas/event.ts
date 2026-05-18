import { z } from "zod"

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1, "請填標題").max(120, "最長 120 字"),
    description: z.string().trim().max(1000, "最長 1000 字").optional(),
    startDateKey: z.string().regex(DATE_KEY_PATTERN, "日期格式錯誤"),
    endDateKey: z.string().regex(DATE_KEY_PATTERN, "日期格式錯誤"),
    participantIds: z.array(z.string()).default([]),
  })
  .refine((v) => v.endDateKey >= v.startDateKey, {
    message: "結束日不能早於開始日",
    path: ["endDateKey"],
  })

export type EventFormValues = z.infer<typeof eventFormSchema>
