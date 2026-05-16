import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// 合併 Tailwind class：clsx 處理條件、twMerge 解決 class 衝突
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
