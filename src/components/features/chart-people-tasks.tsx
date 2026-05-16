"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartColors } from "@/lib/use-chart-colors"

interface PeopleTaskData {
  name: string
  count: number
}

interface Props {
  data: PeopleTaskData[]
}

export function ChartPeopleTasks({ data }: Props) {
  const colors = useChartColors()

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border-default bg-surface text-sm text-text-tertiary">
        還沒有任何成員 / 任務
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            stroke="var(--border-default)"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={64}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            stroke="var(--border-default)"
          />
          <Tooltip
            cursor={{ fill: "var(--bg-subtle)" }}
            contentStyle={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              fontSize: "12px",
            }}
            formatter={(value) => [`${value ?? 0} 筆`, "任務"]}
          />
          <Bar dataKey="count" fill={colors[0] || "var(--chart-1)"} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
