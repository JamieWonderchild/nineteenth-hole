"use client"

import { cn } from "@/lib/utils"

const BAR_THRESHOLDS = [0.05, 0.15, 0.3, 0.5, 0.7]

interface AudioLevelIndicatorProps {
  level: number // 0-1
  className?: string
}

export function AudioLevelIndicator({ level, className }: AudioLevelIndicatorProps) {
  return (
    <div className={cn("flex items-end gap-[3px] h-6 w-10", className)}>
      {BAR_THRESHOLDS.map((threshold, i) => (
        <div
          key={i}
          className={cn(
            "w-1.5 rounded-sm transition-all duration-75",
            level > threshold ? "bg-primary" : "bg-muted"
          )}
          style={{ height: level > threshold ? "100%" : "25%" }}
        />
      ))}
    </div>
  )
}
