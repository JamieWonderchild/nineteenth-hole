"use client"

import * as React from "react"
import type { StreamTranscriptSegment } from "@/types/corti"

interface LiveTranscriptProps {
  segments: StreamTranscriptSegment[]
  isRecording: boolean
  accumulatedTranscript?: string  // Pre-accumulated transcript text
}

export function LiveTranscript({ segments, isRecording, accumulatedTranscript }: LiveTranscriptProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const prevLengthRef = React.useRef(0)

  // Use accumulated transcript if provided, otherwise fall back to segment-based
  const transcriptText = React.useMemo(() => {
    if (accumulatedTranscript) {
      return accumulatedTranscript
    }
    return segments
      .filter((seg) => seg.final)
      .map((seg) => seg.transcript)
      .join(" ")
  }, [accumulatedTranscript, segments])

  // Get the current interim segment (non-final)
  const interimText = React.useMemo(() => {
    const interim = segments.find((seg) => !seg.final)
    return interim?.transcript || ""
  }, [segments])

  // Split into old and new portions for fade animation
  const oldText = transcriptText.slice(0, prevLengthRef.current)
  const newText = transcriptText.slice(prevLengthRef.current)

  // Update prevLengthRef after render
  React.useEffect(() => {
    prevLengthRef.current = transcriptText.length
  }, [transcriptText])

  // Auto-scroll to bottom when transcript changes
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcriptText, segments])

  return (
    <div className="flex flex-col">
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 text-center">
        Transcript
      </h3>
      <div
        ref={scrollRef}
        className="max-h-[400px] overflow-y-auto"
      >
        {segments.length === 0 && !transcriptText ? (
          <p className="text-center text-muted-foreground text-[13px]">
            {isRecording
              ? "Listening… Speak now."
              : "Start recording to see the transcript."}
          </p>
        ) : (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {oldText}
            {newText && (
              <span className="animate-fadeIn">{newText}</span>
            )}
            {interimText && (
              <span className="italic opacity-60">
                {" "}
                {interimText}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
