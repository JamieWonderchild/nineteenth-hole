"use client"

import * as React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RecordingControls } from "./RecordingControls"
import { LiveTranscript } from "./LiveTranscript"
import { AlertCircle, Loader2, CheckCircle, FileCheck, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { DocumentModal, type GeneratedDoc } from "@/components/documents/DocumentModal"
import { CombinedFactsPanel } from "./CombinedFactsPanel"
import { LiveFactsPanel } from "./LiveFactsPanel"
import { useOrgContext } from "@/hooks/useOrgContext"
import { useQuery } from "convex/react"
import { api } from "convex/_generated/api"
import type { Id } from "convex/_generated/dataModel"
import type {
  StreamTranscriptSegment,
  Fact,
  StreamConfig,
  StreamMessage,
  EncounterSession,
} from "@/types/corti"
type ConnectionState = "idle" | "connecting" | "connected" | "error" | "ended"
type ConsultationPhase = "recording" | "processing" | "review" | "saved"

interface RecordingEntry {
  index: number
  interactionId: string
  facts: Array<{ id: string; text: string; group: string }>
  transcript: string
  duration: number
  phase?: string
  createdAt: string
}

// Helper to deduplicate facts by text content
function deduplicateFacts(facts: Fact[]): Fact[] {
  const seenTexts = new Set<string>()
  return facts.filter((fact) => {
    if (fact.isDiscarded) return false
    const normalizedText = fact.text.toLowerCase().trim()
    if (seenTexts.has(normalizedText)) return false
    seenTexts.add(normalizedText)
    return true
  })
}

function formatDuration(seconds: number): string {
  const safeSeconds = seconds || 0
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

const STREAM_CONFIG: StreamConfig = {
  transcription: {
    primaryLanguage: "en",
    isDiarization: true,
    isMultichannel: false,
    participants: [{ channel: 0, role: "multiple" }],
  },
  mode: {
    type: "facts", // Extract facts in real-time
    outputLocale: "en",
  },
}

interface CortiConsultationProps {
  onSessionComplete?: (session: EncounterSession) => void
  onRecordAgain?: () => Promise<void> | void
  patientInfo?: { name?: string; age?: string; sex?: string; weight?: string; weightUnit?: string; _id?: string }
  acceptedCodes?: { icd10: string[]; cpt: string[] }
  consultationType?: "sick-visit" | "wellness" | "emergency" | "follow-up"
  // Multi-recording support
  encounterId?: string
  previousRecordings?: RecordingEntry[]
  initialFacts?: Array<{ id: string; text: string; group: string }>
  initialTranscript?: string
  // Mobile optimization
  isMobile?: boolean
  mobileQuickStart?: boolean
}

export function CortiConsultation({
  onSessionComplete,
  onRecordAgain,
  patientInfo,
  acceptedCodes,
  consultationType = "sick-visit",
  encounterId: externalConsultationId,
  previousRecordings = [],
  initialFacts = [],
  initialTranscript = "",
  isMobile = false,
  mobileQuickStart = false,
}: CortiConsultationProps) {
  // Org context
  const { orgContext } = useOrgContext()

  // Fetch accepted codes from Convex so they're included in document generation
  // even if the parent didn't pass them as a prop
  const encounterRecord = useQuery(
    api.encounters.getById,
    externalConsultationId ? { id: externalConsultationId as Id<'encounters'> } : 'skip'
  )
  const resolvedCodes = acceptedCodes ?? {
    icd10: encounterRecord?.icd10Codes ?? [],
    cpt: encounterRecord?.cptCodes ?? [],
  }

  // Connection state
  const [connectionState, setConnectionState] = React.useState<ConnectionState>("idle")
  const [error, setError] = React.useState<string | null>(null)

  // Recording state
  const [isRecording, setIsRecording] = React.useState(false)
  const [isPaused, setIsPaused] = React.useState(false)
  const [duration, setDuration] = React.useState(0)

  // Data state
  const [segments, setSegments] = React.useState<StreamTranscriptSegment[]>([])
  const [facts, setFacts] = React.useState<Fact[]>([])
  const [interactionId, setInteractionId] = React.useState<string | null>(null)

  // Phase management
  const [phase, setPhase] = React.useState<ConsultationPhase>("recording")

  // Multi-recording tracking
  const [completedRecordings, setCompletedRecordings] = React.useState<RecordingEntry[]>(previousRecordings)

  // Document generation state
  const [soapNote, setSoapNote] = React.useState<GeneratedDoc | null>(null)
  const [afterVisitSummary, setAfterVisitSummary] = React.useState<GeneratedDoc | null>(null)
  const [isGeneratingDocs, setIsGeneratingDocs] = React.useState(false)
  const [docError, setDocError] = React.useState<string | null>(null)
  const [showDocModal, setShowDocModal] = React.useState(false)

  // Review phase: collapsible transcript
  const [showTranscript, setShowTranscript] = React.useState(false)

  // Refs for WebSocket and audio
  const connectionStateRef = React.useRef<ConnectionState>("idle")
  const isFlushing = React.useRef(false)
  const wsRef = React.useRef<WebSocket | null>(null)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const timerRef = React.useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = React.useRef<string | null>(null)

  // Refs to track latest data (avoids stale closure issues)
  const segmentsRef = React.useRef<StreamTranscriptSegment[]>([])
  const factsRef = React.useRef<Fact[]>([])
  const durationRef = React.useRef<number>(0)
  const interactionIdRef = React.useRef<string | null>(null)

  // Transcript accumulation refs (corti-showcase pattern)
  const seenTranscriptsRef = React.useRef<Set<string>>(new Set())
  const accumulatedTranscriptRef = React.useRef<string>("")
  const [displayTranscript, setDisplayTranscript] = React.useState<string>("")

  // Audio level monitoring
  const [audioLevel, setAudioLevel] = React.useState(0)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const rafIdRef = React.useRef<number>(0)

  // Sync refs with state
  React.useEffect(() => { connectionStateRef.current = connectionState }, [connectionState])
  React.useEffect(() => { segmentsRef.current = segments }, [segments])
  React.useEffect(() => { factsRef.current = facts }, [facts])
  React.useEffect(() => { durationRef.current = duration }, [duration])
  React.useEffect(() => { interactionIdRef.current = interactionId }, [interactionId])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Build transcript string - prefer accumulated transcript
  const transcriptText = React.useMemo(() => {
    if (displayTranscript) {
      return displayTranscript
    }
    return segments
      .filter((s) => s.final)
      .map((s) => s.transcript)
      .join(" ")
  }, [displayTranscript, segments])

  // Deduplicated active facts
  const activeFacts = React.useMemo(() => {
    return deduplicateFacts(facts)
  }, [facts])

  // Combined facts across all recordings (current + previous)
  const allRecordingFacts = React.useMemo(() => {
    const currentFacts = activeFacts.map(f => ({ id: f.id, text: f.text, group: f.group }))
    // Include initial facts (from pre-encounter or prior recordings)
    const allFacts = [...initialFacts]
    const seenTexts = new Set(allFacts.map(f => f.text.toLowerCase().trim()))

    // Add facts from completed recordings
    for (const rec of completedRecordings) {
      for (const fact of rec.facts) {
        const key = fact.text.toLowerCase().trim()
        if (!seenTexts.has(key)) {
          seenTexts.add(key)
          allFacts.push(fact)
        }
      }
    }

    // Add current recording's facts
    for (const fact of currentFacts) {
      const key = fact.text.toLowerCase().trim()
      if (!seenTexts.has(key)) {
        seenTexts.add(key)
        allFacts.push(fact)
      }
    }

    return allFacts
  }, [initialFacts, completedRecordings, activeFacts])

  // Total duration across all recordings
  const totalDuration = React.useMemo(() => {
    return completedRecordings.reduce((sum, r) => sum + r.duration, 0) + duration
  }, [completedRecordings, duration])

  // Handle "Add Follow-Up Recording" — reset recording state and go back to recording phase
  const handleAddFollowUpRecording = React.useCallback(async () => {
    // Call parent's onRecordAgain to delete auto-saved recording if it exists
    if (onRecordAgain) {
      await onRecordAgain();
    }

    // Save current state and reset recording-specific state
    setConnectionState("idle")
    setError(null)
    setSegments([])
    setFacts([])
    setDuration(0)
    setInteractionId(null)
    setPhase("recording")
    setIsRecording(false)
    setIsPaused(false)
    setShowTranscript(false)
    segmentsRef.current = []
    factsRef.current = []
    durationRef.current = 0
    interactionIdRef.current = null
    seenTranscriptsRef.current = new Set()
    accumulatedTranscriptRef.current = ""
    setDisplayTranscript("")
    setCompletedRecordings([]) // Reset completed recordings since we're starting fresh
  }, [onRecordAgain])

  // Transition to saved phase
  const handleGoToSaved = React.useCallback(() => {
    setPhase("saved")
  }, [])

  const handleStart = async () => {
    setError(null)
    setConnectionState("connecting")
    setSegments([])
    setFacts([])
    setDuration(0)
    setPhase("recording")

    segmentsRef.current = []
    factsRef.current = []
    durationRef.current = 0
    startTimeRef.current = new Date().toISOString()
    // Reset transcript accumulation
    seenTranscriptsRef.current = new Set()
    accumulatedTranscriptRef.current = ""
    setDisplayTranscript("")

    try {
      // Check for microphone support before requesting
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          /CriOS|Chrome/.test(navigator.userAgent) && /iPhone|iPad|iPod/.test(navigator.userAgent)
            ? "Microphone access is not supported in Chrome on iOS. Please open this page in Safari instead."
            : "Microphone access is not supported in this browser."
        )
      }

      // Request microphone permission
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
        })
      } catch (micErr) {
        if (micErr instanceof DOMException && (micErr.name === "NotAllowedError" || micErr.name === "NotFoundError")) {
          throw new Error(
            "Microphone permission was denied. Please allow microphone access in your browser settings and try again."
          )
        }
        throw micErr
      }

      // Get WebSocket connection details from our API
      const response = await fetch("/api/corti/stream", { method: "POST" })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to initialize stream")
      }

      const { interactionId: newInteractionId, wsUrl } = await response.json()
      setInteractionId(newInteractionId)
      interactionIdRef.current = newInteractionId

      // Connect WebSocket
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        // Send configuration
        ws.send(JSON.stringify({ type: "config", configuration: STREAM_CONFIG }))
      }

      ws.onmessage = async (event) => {
        try {
          // iOS Safari may deliver WebSocket text frames as Blobs
          let raw: string
          if (typeof event.data === "string") {
            raw = event.data
          } else if (event.data instanceof Blob) {
            raw = await event.data.text()
          } else {
            // ArrayBuffer or other binary — not a JSON message
            return
          }

          const message = JSON.parse(raw) as StreamMessage

          switch (message.type) {
            case "CONFIG_ACCEPTED":
              setConnectionState("connected")
              setIsRecording(true)
              startAudioCapture(stream, ws)
              startTimer()
              break

            case "transcript":
              if (message.data && Array.isArray(message.data)) {
                // Text-based deduplication (corti-showcase pattern)
                let newText = ""
                ;(message.data as StreamTranscriptSegment[]).forEach((seg) => {
                  if (seg.transcript && seg.final && !seenTranscriptsRef.current.has(seg.transcript)) {
                    seenTranscriptsRef.current.add(seg.transcript)
                    newText += " " + seg.transcript
                  }
                })
                if (newText) {
                  accumulatedTranscriptRef.current += newText
                  setDisplayTranscript(accumulatedTranscriptRef.current.trim())
                }
                // Still track segments for interim display
                setSegments((prev) => {
                  const updated = [...prev]
                  ;(message.data as StreamTranscriptSegment[]).forEach((newSeg) => {
                    const existingIndex = updated.findIndex((s) => s.id === newSeg.id)
                    if (existingIndex >= 0) {
                      updated[existingIndex] = newSeg
                    } else {
                      updated.push(newSeg)
                    }
                  })
                  return updated
                })
              }
              break

            case "facts":
              if (message.fact && Array.isArray(message.fact)) {
                // Clear any previous errors - if we're receiving facts, connection is working
                setError(null)
                setFacts((prev) => {
                  const updated = [...prev]
                  ;(message.fact as Fact[]).forEach((newFact) => {
                    const existingIndex = updated.findIndex((f) => f.id === newFact.id)
                    if (existingIndex >= 0) {
                      updated[existingIndex] = newFact
                    } else {
                      updated.push(newFact)
                    }
                  })
                  return updated
                })
              }
              break

            case "flushed":
              // No longer used — we send "end" directly (matching Corti reference)
              break

            case "ENDED":
              isFlushing.current = false
              setConnectionState("ended")
              // Brief delay so the processing state feels intentional, then show review
              if (interactionIdRef.current) {
                const dedupedFacts = deduplicateFacts(factsRef.current)
                const session: EncounterSession = {
                  interactionId: interactionIdRef.current,
                  transcript: segmentsRef.current,
                  transcriptText: accumulatedTranscriptRef.current.trim(),
                  facts: dedupedFacts,
                  duration: durationRef.current,
                  createdAt: startTimeRef.current || new Date().toISOString(),
                  encounterId: externalConsultationId,
                }

                // Track this recording
                setCompletedRecordings(prev => [...prev, {
                  index: prev.length,
                  interactionId: interactionIdRef.current!,
                  facts: dedupedFacts.map(f => ({ id: f.id, text: f.text, group: f.group })),
                  transcript: accumulatedTranscriptRef.current.trim(),
                  duration: durationRef.current,
                  phase: undefined,
                  createdAt: startTimeRef.current || new Date().toISOString(),
                }])

                onSessionComplete?.(session)
              }
              // Show processing for at least 1.5s so it doesn't flash
              setTimeout(() => setPhase("review"), 1500)
              break

            case "error":
              console.error("Stream error:", message)
              setError((message as { title?: string }).title || "Stream error occurred")
              setConnectionState("error")
              break

            default:
              break
          }
        } catch (parseErr) {
          console.error("Failed to parse WebSocket message:", parseErr, "data type:", typeof event.data)
        }
      }

      ws.onerror = (event) => {
        console.error("WebSocket error:", event)
        // Don't show error immediately - often transient network issues
        // Only show error if connection actually fails (handled in onclose)
      }

      ws.onclose = (event) => {
        // Only show error for truly unexpected closures while actively recording.
        // 1000 = clean close, 1005 = no status, 1006 = Corti's normal post-ENDED close
        if (event.code !== 1000 && event.code !== 1005 && event.code !== 1006 && connectionStateRef.current === "connected") {
          setError(`Connection lost (code ${event.code}${event.reason ? ": " + event.reason : ""}). Please try again.`)
          setConnectionState("error")
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start recording"
      setError(message)
      setConnectionState("error")
    }
  }

  const startAudioCapture = (stream: MediaStream, ws: WebSocket) => {
    // Pick a supported audio format (webm/opus preferred, mp4 fallback for iOS)
    const supportedTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ]
    const mimeType = supportedTypes.find((t) => MediaRecorder.isTypeSupported(t))
    if (!mimeType) {
      setError("Your browser does not support audio recording. Please try Safari on iOS or Chrome on desktop.")
      setConnectionState("error")
      stream.getTracks().forEach((track) => track.stop())
      ws.close()
      return
    }
    const mediaRecorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = mediaRecorder

    // Set up AudioContext + AnalyserNode for audio level monitoring
    try {
      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.3
      analyserRef.current = analyser
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let lastUpdate = 0
      const updateLevel = (time: number) => {
        rafIdRef.current = requestAnimationFrame(updateLevel)
        // Throttle to ~15fps
        if (time - lastUpdate < 66) return
        lastUpdate = time
        analyser.getByteFrequencyData(dataArray)
        // Compute RMS level normalized to 0-1
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = dataArray[i] / 255
          sum += normalized * normalized
        }
        const rms = Math.sqrt(sum / dataArray.length)
        setAudioLevel(rms)
      }
      rafIdRef.current = requestAnimationFrame(updateLevel)
    } catch {
      // AudioContext not supported — audio level indicator just won't show
    }

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        // Send audio data as binary
        const arrayBuffer = await event.data.arrayBuffer()
        ws.send(arrayBuffer)
      }
    }

    mediaRecorder.onerror = (e) => {
      console.error("MediaRecorder error:", e)
      setError("Audio recording error. Please try again.")
      setConnectionState("error")
    }

    // 200ms chunks per Corti reference implementation
    mediaRecorder.start(200)
  }

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setDuration((prev) => {
        durationRef.current = prev + 1
        return prev + 1
      })
    }, 1000)
  }

  const handleStop = () => {
    isFlushing.current = true
    setPhase("processing")

    // Match Corti reference: send "end" first, then stop MediaRecorder,
    // keep WebSocket open so remaining facts can arrive.
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Flush MediaRecorder buffer so last audio chunk is sent
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.requestData()
      }

      // Brief delay to let the last audio chunk send, then tell Corti to end
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "end" }))
        }
        // Stop MediaRecorder after sending end
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop()
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
        }
      }, 500)
    } else {
      // WebSocket not open — just stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      }
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    // Stop audio level monitoring
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = 0
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setAudioLevel(0)

    setIsRecording(false)
  }

  const handlePause = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      setIsPaused(true)
    }
  }

  const handleResume = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume()
      startTimer()
      setIsPaused(false)
    }
  }

  const handleReset = () => {
    setConnectionState("idle")
    setError(null)
    setSegments([])
    setFacts([])
    setDuration(0)
    setInteractionId(null)
    setPhase("recording")

    segmentsRef.current = []
    factsRef.current = []
    durationRef.current = 0
    interactionIdRef.current = null
    // Reset transcript accumulation
    seenTranscriptsRef.current = new Set()
    accumulatedTranscriptRef.current = ""
    setDisplayTranscript("")
    // Reset document state
    setSoapNote(null)
    setAfterVisitSummary(null)
    setDocError(null)
    setShowDocModal(false)
  }

  // Generate documents using Corti API
  const generateDocuments = React.useCallback(async () => {
    if (!interactionId || activeFacts.length === 0) {
      return
    }

    setIsGeneratingDocs(true)
    setDocError(null)

    try {
      const requestBody = {
        interactionId,
        facts: activeFacts,
        transcript: transcriptText,
        patientName: patientInfo?.name,
        acceptedCodes: resolvedCodes,
      }

      // Generate both documents in parallel
      const [soapResponse, clientResponse] = await Promise.all([
        fetch("/api/corti/generate-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...requestBody,
            documentType: "soap-note",
          }),
        }),
        fetch("/api/corti/generate-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...requestBody,
            documentType: "after-visit-summary",
          }),
        }),
      ])

      // Parse responses
      const soapText = await soapResponse.text()
      const clientText = await clientResponse.text()

      let soapData: any = null
      let clientData: any = null
      const errors: string[] = []

      if (soapResponse.ok) {
        try {
          soapData = JSON.parse(soapText)
          setSoapNote({
            sections: soapData.sections,
            generatedAt: soapData.generatedAt,
          })
        } catch {
          console.error("[DocumentGen] Failed to parse SOAP response:", soapText)
          errors.push("SOAP: Invalid response format")
        }
      } else {
        console.error("[DocumentGen] SOAP note failed:", soapResponse.status, soapText)
        try {
          const errorData = JSON.parse(soapText)
          errors.push(`SOAP: ${errorData.details || errorData.error || 'Unknown error'}`)
        } catch {
          errors.push(`SOAP: ${soapResponse.status} - ${soapText.slice(0, 100)}`)
        }
      }

      if (clientResponse.ok) {
        try {
          clientData = JSON.parse(clientText)
          setAfterVisitSummary({
            sections: clientData.sections,
            generatedAt: clientData.generatedAt,
          })
        } catch {
          console.error("[DocumentGen] Failed to parse after-visit summary response:", clientText)
          errors.push("After-Visit Summary: Invalid response format")
        }
      } else {
        console.error("[DocumentGen] After-visit summary failed:", clientResponse.status, clientText)
        try {
          const errorData = JSON.parse(clientText)
          errors.push(`Patient Summary: ${errorData.details || errorData.error || 'Unknown error'}`)
        } catch {
          errors.push(`Patient Summary: ${clientResponse.status} - ${clientText.slice(0, 100)}`)
        }
      }

      // If both failed, throw with combined error messages
      if (!soapResponse.ok && !clientResponse.ok) {
        throw new Error(errors.join("; "))
      }

      // Partial success is OK - no action needed if only one failed
    } catch (err) {
      console.error("Document generation error:", err)
      setDocError(err instanceof Error ? err.message : "Failed to generate documents")
    } finally {
      setIsGeneratingDocs(false)
    }
  }, [interactionId, activeFacts, transcriptText, patientInfo?.name])


  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Recording Phase */}
      {phase === "recording" && (
        <>
          {/* Idle: centered mic with guidance */}
          {connectionState === "idle" && !isRecording && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">Speak naturally about the patient</p>
                <p className="text-xs text-muted-foreground">Vitals, findings, and history will be captured</p>
              </div>
              <RecordingControls
                isRecording={false}
                isPaused={false}
                duration={0}
                onStart={handleStart}
                onStop={handleStop}
                onPause={handlePause}
                onResume={handleResume}
              />
            </div>
          )}

          {/* Error: retry button */}
          {connectionState === "error" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <RecordingControls
                isRecording={false}
                isPaused={false}
                duration={0}
                onStart={handleStart}
                onStop={handleStop}
                onPause={handlePause}
                onResume={handleResume}
              />
              <p className="text-sm text-muted-foreground">Tap to try again</p>
            </div>
          )}

          {/* Connecting: centered mic with spinner */}
          {connectionState === "connecting" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">Connecting...</p>
                <p className="text-xs text-muted-foreground">Setting up audio stream</p>
              </div>
              <RecordingControls
                isRecording={false}
                isPaused={false}
                duration={0}
                onStart={handleStart}
                onStop={handleStop}
                onPause={handlePause}
                onResume={handleResume}
                disabled={true}
                isConnecting={true}
              />
            </div>
          )}

          {/* Active recording: controls + transcript + live facts */}
          {(connectionState === "connected" || (isRecording && connectionState !== "idle")) && (
            <div className={`flex flex-col items-center space-y-6 ${isMobile ? 'min-h-[60vh] justify-center' : ''}`}>
              <RecordingControls
                isRecording={isRecording}
                isPaused={isPaused}
                duration={duration}
                onStart={handleStart}
                onStop={handleStop}
                onPause={handlePause}
                onResume={handleResume}
                disabled={connectionState === "ended"}
                isConnecting={false}
                audioLevel={audioLevel}
              />
              <div className="w-full">
                <LiveTranscript segments={segments} isRecording={isRecording} accumulatedTranscript={displayTranscript} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Processing Phase */}
      {phase === "processing" && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">Finalizing recording...</p>
            <p className="text-xs text-muted-foreground">{formatDuration(duration)} recorded</p>
          </div>
        </div>
      )}

      {/* Review Phase */}
      {phase === "review" && (
        <div className="flex flex-col items-center py-10 space-y-6">
          <div className="flex flex-col items-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-semibold">Recording Complete</p>
              <p className="text-sm text-muted-foreground">
                {formatDuration(duration)} &middot; {completedRecordings[completedRecordings.length - 1]?.facts.length || 0} facts extracted
              </p>
              {(initialFacts.length > 0 || completedRecordings.length > 1) && (
                <p className="text-xs text-muted-foreground">
                  + {allRecordingFacts.length - (completedRecordings[completedRecordings.length - 1]?.facts.length || 0)} facts from prior recordings
                </p>
              )}
            </div>
          </div>

          {/* Facts Panel */}
          <div className={`w-full ${isMobile ? 'px-2' : 'max-w-2xl'}`}>
            <CombinedFactsPanel
              recordings={completedRecordings.map(rec => ({
                recordingIndex: rec.index,
                phase: rec.phase,
                createdAt: rec.createdAt,
                facts: rec.facts,
              }))}
              editable={true}
              isMobile={isMobile}
              onFactEdit={(factId: string, newText: string) => {
                setCompletedRecordings(prev => prev.map(rec => ({
                  ...rec,
                  facts: rec.facts.map(f => f.id === factId ? { ...f, text: newText } : f)
                })))
              }}
              onFactDelete={(factId: string) => {
                setCompletedRecordings(prev => prev.map(rec => ({
                  ...rec,
                  facts: rec.facts.filter(f => f.id !== factId)
                })))
              }}
            />
          </div>

          {/* Collapsible transcript */}
          <button
            onClick={() => setShowTranscript(prev => !prev)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showTranscript ? "Hide Transcript" : "View Transcript"}
          </button>
          {showTranscript && (
            <div className="w-full max-w-2xl rounded-lg border bg-card p-4">
              <LiveTranscript segments={segments} isRecording={false} accumulatedTranscript={displayTranscript} />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleAddFollowUpRecording} className="gap-2">
              <Plus className="h-4 w-4" />
              Record Again
            </Button>
          </div>
        </div>
      )}

      {/* Saved Phase */}
      {phase === "saved" && (
        <div className="flex flex-col items-center py-10 space-y-6">
          <div className="flex flex-col items-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center">
              <FileCheck className="h-7 w-7 text-blue-600" />
            </div>
            <p className="text-sm text-muted-foreground">
              {completedRecordings.length} recording{completedRecordings.length !== 1 ? "s" : ""} &middot;{" "}
              {formatDuration(totalDuration)} total &middot; {allRecordingFacts.length} facts
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button onClick={handleAddFollowUpRecording} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Follow-Up Recording
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Start New Encounter
            </Button>
          </div>
        </div>
      )}

      {/* Document Modal */}
      <DocumentModal
        open={showDocModal}
        onOpenChange={setShowDocModal}
        soapNote={soapNote}
        afterVisitSummary={afterVisitSummary}
        isLoading={isGeneratingDocs}
        error={docError}
        patientName={patientInfo?.name}
        onRetry={() => {
          setDocError(null)
          setSoapNote(null)
          setAfterVisitSummary(null)
          generateDocuments()
        }}
      />
    </div>
  )
}
