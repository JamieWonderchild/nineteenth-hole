"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Mic, Square, Pause, Play } from "lucide-react"
import { AudioLevelIndicator } from "./AudioLevelIndicator"

interface RecordingControlsProps {
  isRecording: boolean
  isPaused: boolean
  duration: number
  onStart: () => void
  onStop: () => void
  onPause: () => void
  onResume: () => void
  disabled?: boolean
  isConnecting?: boolean
  audioLevel?: number
}

function formatDuration(seconds: number): string {
  const safeSeconds = seconds || 0
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function RecordingControls({
  isRecording,
  isPaused,
  duration,
  onStart,
  onStop,
  onPause,
  onResume,
  disabled = false,
  isConnecting = false,
  audioLevel,
}: RecordingControlsProps) {
  const showAudioLevel = isRecording && audioLevel !== undefined

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-4">
      {!isRecording ? (
        <Button
          size="lg"
          onClick={onStart}
          disabled={disabled || isConnecting}
          className="h-20 w-20 rounded-full"
        >
          {isConnecting ? (
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Mic className="h-7 w-7" />
          )}
        </Button>
      ) : (
        <>
          <Button
            size="lg"
            variant="outline"
            onClick={isPaused ? onResume : onPause}
            className="h-12 w-12 rounded-full"
          >
            {isPaused ? (
              <Play className="h-5 w-5" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
          </Button>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isPaused ? "bg-yellow-400" : "bg-red-400 animate-ping"
                  }`}
                />
                <span
                  className={`relative inline-flex h-3 w-3 rounded-full ${
                    isPaused ? "bg-yellow-500" : "bg-red-500"
                  }`}
                />
              </span>
              {showAudioLevel && <AudioLevelIndicator level={audioLevel} />}
              <span className="text-sm font-medium text-muted-foreground">
                {isPaused ? "Paused" : "Recording"}
              </span>
            </div>
            <span className="text-2xl font-mono font-semibold tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>

          <Button
            size="lg"
            variant="destructive"
            onClick={onStop}
            className="h-12 w-12 rounded-full"
          >
            <Square className="h-5 w-5" />
          </Button>
        </>
      )}
      </div>
    </div>
  )
}
