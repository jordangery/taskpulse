import { z } from "zod"

export const STATUS_SUGGESTIONS = ["進行中", "卡住", "待確認", "完成"] as const

// summary 5-500 字（spec features.md 第 63 行）
// percentage 0-100 選填、status 自由字串選填（有建議清單但允許自由輸入）
// 字串/null 轉換放 action，保持 RHF input/output 型別一致
export const progressUpdateFormSchema = z.object({
  summary: z.string().trim().min(5, "至少 5 個字").max(500, "最長 500 字"),
  percentage: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v) return true
        const n = Number(v)
        return Number.isInteger(n) && n >= 0 && n <= 100
      },
      { message: "百分比要 0-100 整數" },
    ),
  status: z.string().trim().max(20, "最長 20 字").optional(),
})

export type ProgressUpdateFormValues = z.infer<typeof progressUpdateFormSchema>
