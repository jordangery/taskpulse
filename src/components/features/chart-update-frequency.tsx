"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useChartColors } from "@/lib/use-chart-colors"

interface FrequencyData {
  date: string // "YYYY-MM-DD"
  label: string // "週一", "5/12" 等
  count: number
}

interface Props {
  data: FrequencyData[]
}

export function ChartUpdateFrequency({ data }: Props) {
  const colors = useChartColors()

  const total = data.reduce((sum, d) => sum + d.count, 0)
  if (total === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border-default bg-surface text-sm text-text-tertiary">
        本週還沒有人寫進度
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            stroke="var(--border-default)"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            stroke="var(--border-default)"
          />
          <Tooltip
            cursor={{ stroke: "var(--border-default)", strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`${value} 筆`, "進度"]}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke={colors[1] || "var(--chart-2)"}
            strokeWidth={2}
            dot={{ fill: colors[1] || "var(--chart-2)", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
