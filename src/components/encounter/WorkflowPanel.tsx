'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  FileText,
  Send,
  CheckCircle,
  Loader2,
  AlertCircle,
  ClipboardList,
  Stethoscope,
  FileCheck,
  FlaskConical,
  CalendarCheck,
  ArrowLeftRight,
} from 'lucide-react'
import { useMutation } from 'convex/react'
import { useLanguagePreference } from '@/hooks/useLanguagePreference'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentType {
  id: string
  label: string
  description: string
  icon: React.ReactNode
}

interface GeneratedDocument {
  type: string
  title: string
  sections: Array<{ key: string; title: string; content: string }>
}

interface AgentProgress {
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

export interface WorkflowPanelProps {
  interactionId: string
  facts: Array<{ id: string; text: string; group: string }>
  transcript?: string
  patientInfo?: {
    name?: string
    age?: string
    sex?: string
    weight?: number
    weightUnit?: 'kg' | 'lbs'
  }
  onDocumentsGenerated?: (documents: GeneratedDocument[]) => void
  // Multi-recording support
  previousDocuments?: GeneratedDocument[]
  isRegeneration?: boolean
  // Evidence findings from uploaded files (M4)
  evidenceFindings?: Array<{ id: string; text: string; group: string; confidence?: number }>
  // Prior encounter context (M5)
  priorContext?: Array<{ encounterId: string; date: string; facts: Array<{ id: string; text: string; group: string }>; diagnosis?: string }>
  // When provided, auto-saves generated docs + provider notes to DB
  encounterId?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOCUMENT_TYPES: DocumentType[] = [
  {
    id: 'soap-note',
    label: 'SOAP Note',
    description: 'Structured clinical record',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'after-visit-summary',
    label: 'After-Visit Summary',
    description: 'Plain-language summary for the patient',
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    id: 'discharge-instructions',
    label: 'Discharge Instructions',
    description: 'Take-home care instructions',
    icon: <FileCheck className="h-4 w-4" />,
  },
  {
    id: 'referral-letter',
    label: 'Referral Letter',
    description: 'Letter to a specialist or emergency clinic',
    icon: <Send className="h-4 w-4" />,
  },
  {
    id: 'prescription',
    label: 'Prescription',
    description: 'Medication prescription details',
    icon: <Stethoscope className="h-4 w-4" />,
  },
  {
    id: 'follow-up-plan',
    label: 'Follow-Up Plan',
    description: 'Follow-up schedule and monitoring',
    icon: <CalendarCheck className="h-4 w-4" />,
  },
  {
    id: 'lab-order',
    label: 'Lab Order',
    description: 'Lab work and diagnostic test orders',
    icon: <FlaskConical className="h-4 w-4" />,
  },
  {
    id: 'shift-handoff',
    label: 'Shift Handoff',
    description: 'SBAR handoff note for care transitions',
    icon: <ArrowLeftRight className="h-4 w-4" />,
  },
]

const DEFAULT_SELECTED = ['soap-note']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowPanel({
  interactionId,
  facts,
  transcript,
  patientInfo,
  onDocumentsGenerated,
  previousDocuments = [],
  isRegeneration = false,
  evidenceFindings,
  priorContext,
  encounterId,
}: WorkflowPanelProps) {
  // Convex mutations for auto-saving
  const saveDocsMutation = useMutation(api.encounters.saveGeneratedDocuments)
  const saveVetNotesMutation = useMutation(api.encounters.saveVetNotes)
  const { language } = useLanguagePreference()

  // Document selection
  const [selectedDocs, setSelectedDocs] = React.useState<Set<string>>(
    () => new Set(DEFAULT_SELECTED)
  )

  // Provider notes
  const [vetDiagnosis, setVetDiagnosis] = React.useState('')
  const [vetTreatmentNotes, setVetTreatmentNotes] = React.useState('')

  // Generation state
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [agentProgress, setAgentProgress] = React.useState<AgentProgress[]>([])
  const [generatedDocs, setGeneratedDocs] = React.useState<GeneratedDocument[]>([])
  const [generateError, setGenerateError] = React.useState<string | null>(null)

  const toggleDocSelection = React.useCallback((docId: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
      } else {
        next.add(docId)
      }
      return next
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Auto-save to DB
  // ---------------------------------------------------------------------------

  const DOC_TYPE_TO_DB_KEY: Record<string, string> = {
    'soap-note': 'soapNote',
    'after-visit-summary': 'afterVisitSummary',
    'discharge-instructions': 'dischargeInstructions',
    'referral-letter': 'referralLetter',
    'prescription': 'prescription',
    'follow-up-plan': 'followUpPlan',
    'lab-order': 'labOrder',
    'shift-handoff': 'shiftHandoff',
  }

  const saveToDb = React.useCallback(async (docs: GeneratedDocument[]) => {
    if (!encounterId || docs.length === 0) return

    const timestamp = new Date().toISOString()

    // Build the document payload
    const docPayload: Record<string, { sections: Array<{ key: string; title: string; content: string }>; generatedAt: string }> = {}
    for (const doc of docs) {
      const dbKey = DOC_TYPE_TO_DB_KEY[doc.type]
      if (dbKey) {
        docPayload[dbKey] = {
          sections: doc.sections,
          generatedAt: timestamp,
        }
      }
    }

    try {
      await saveDocsMutation({
        encounterId: encounterId as Id<"encounters">,
        ...docPayload,
      })
    } catch (err) {
      console.error('[WorkflowPanel] Failed to save documents:', err)
    }

    // Save provider notes if entered
    if (vetDiagnosis || vetTreatmentNotes) {
      try {
        await saveVetNotesMutation({
          encounterId: encounterId as Id<"encounters">,
          diagnosis: vetDiagnosis || undefined,
          treatmentPlan: vetTreatmentNotes || undefined,
        })
      } catch (err) {
        console.error('[WorkflowPanel] Failed to save provider notes:', err)
      }
    }
  }, [encounterId, saveDocsMutation, saveVetNotesMutation, vetDiagnosis, vetTreatmentNotes])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleGenerate = React.useCallback(async () => {
    if (selectedDocs.size === 0) return

    setIsGenerating(true)
    setGenerateError(null)
    setGeneratedDocs([])

    const docTypes = Array.from(selectedDocs)

    // Initialize progress for each selected document type
    const initialProgress: AgentProgress[] = docTypes.map((docId) => ({
      name: DOCUMENT_TYPES.find((d) => d.id === docId)?.label || docId,
      status: 'pending' as const,
    }))
    setAgentProgress(initialProgress)

    try {
      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactionId,
          documents: docTypes,
          facts,
          transcript,
          patientInfo,
          vetDiagnosis: vetDiagnosis || undefined,
          vetTreatmentPlan: vetTreatmentNotes || undefined,
          evidenceFindings: evidenceFindings && evidenceFindings.length > 0 ? evidenceFindings : undefined,
          priorContext: priorContext && priorContext.length > 0 ? priorContext : undefined,
          language,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Generation failed (${response.status})`
        )
      }

      // If the API supports streaming progress, handle SSE; otherwise parse JSON
      const contentType = response.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream')) {
        // SSE streaming mode: read agent progress updates
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        const results: GeneratedDocument[] = []

        if (reader) {
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            // Parse SSE events from buffer
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6))

                  if (event.type === 'agent-progress') {
                    setAgentProgress((prev) =>
                      prev.map((p) =>
                        p.name === event.agent
                          ? { ...p, status: event.status, error: event.error }
                          : p
                      )
                    )
                  }

                  if (event.type === 'document-ready') {
                    results.push(event.document)
                    setGeneratedDocs([...results])
                  }
                } catch {
                  // Skip malformed SSE lines
                }
              }
            }
          }
        }

        // Mark all as completed
        setAgentProgress((prev) =>
          prev.map((p) => ({
            ...p,
            status: p.status === 'running' || p.status === 'pending' ? 'completed' : p.status,
          }))
        )
        onDocumentsGenerated?.(results)
        saveToDb(results)
      } else {
        // Standard JSON response mode
        const data = await response.json()
        const docs: GeneratedDocument[] = data.documents || []

        // Check agent trace for errors
        const traceErrors: string[] = []
        if (data.agentTrace && Array.isArray(data.agentTrace)) {
          for (const entry of data.agentTrace) {
            if (entry.status === 'error' && entry.error) {
              traceErrors.push(entry.error)
            }
          }
        }

        if (docs.length === 0 && traceErrors.length > 0) {
          // All documents failed — surface the error
          throw new Error(`Document generation failed: ${traceErrors.join('; ')}`)
        }

        // Mark progress based on which docs actually came back
        const generatedTypes = new Set(docs.map((d) => d.type))
        setAgentProgress(
          docTypes.map((docId) => ({
            name: DOCUMENT_TYPES.find((d) => d.id === docId)?.label || docId,
            status: generatedTypes.has(docId) ? ('completed' as const) : ('error' as const),
            error: generatedTypes.has(docId) ? undefined : 'No content returned',
          }))
        )

        setGeneratedDocs(docs)
        onDocumentsGenerated?.(docs)
        saveToDb(docs)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate documents'
      setGenerateError(message)
      setAgentProgress((prev) =>
        prev.map((p) =>
          p.status === 'pending' || p.status === 'running'
            ? { ...p, status: 'error' as const, error: message }
            : p
        )
      )
    } finally {
      setIsGenerating(false)
    }
  }, [
    selectedDocs,
    interactionId,
    facts,
    transcript,
    patientInfo,
    vetDiagnosis,
    vetTreatmentNotes,
    onDocumentsGenerated,
    evidenceFindings,
    priorContext,
    saveToDb,
  ])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">

      {/* Document Selection — compact chip-style */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documents</h3>
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_TYPES.map((doc) => {
            const isChecked = selectedDocs.has(doc.id)
            return (
              <button
                key={doc.id}
                onClick={() => toggleDocSelection(doc.id)}
                disabled={isGenerating}
                className={`
                  flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer
                  ${isChecked
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input text-muted-foreground hover:border-primary/50'
                  }
                  ${isGenerating ? 'pointer-events-none opacity-60' : ''}
                `}
              >
                {doc.icon}
                {doc.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Optional Provider Notes — inline, no card */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Stethoscope className="h-3 w-3" />
          Provider Notes
          <span className="font-normal">(optional)</span>
        </h3>
        <div className="space-y-2">
          <Textarea
            id="provider-diagnosis"
            placeholder="Your diagnosis..."
            value={vetDiagnosis}
            onChange={(e) => setVetDiagnosis(e.target.value)}
            disabled={isGenerating}
            rows={1}
            className="resize-none text-sm"
          />
          <Textarea
            id="provider-treatment"
            placeholder="Treatment notes..."
            value={vetTreatmentNotes}
            onChange={(e) => setVetTreatmentNotes(e.target.value)}
            disabled={isGenerating}
            rows={1}
            className="resize-none text-sm"
          />
        </div>
      </div>

      {/* Generate Button */}
      <Button
        size="lg"
        onClick={handleGenerate}
        disabled={isGenerating || selectedDocs.size === 0}
        className="gap-2 w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isRegeneration ? 'Regenerating...' : 'Generating...'}
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            {isRegeneration ? 'Regenerate' : 'Generate'} {selectedDocs.size} Document{selectedDocs.size !== 1 ? 's' : ''}
          </>
        )}
      </Button>

      {/* Generation Progress */}
      {agentProgress.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : generateError ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              {isGenerating
                ? 'Generating...'
                : generateError
                  ? 'Generation Error'
                  : 'Generation Complete'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {agentProgress.map((agent) => (
                <div
                  key={agent.name}
                  className="flex items-center gap-3 text-sm"
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    {agent.status === 'pending' && (
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                    )}
                    {agent.status === 'running' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {agent.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {agent.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <span
                    className={
                      agent.status === 'completed'
                        ? 'text-foreground'
                        : agent.status === 'error'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }
                  >
                    {agent.name}
                  </span>
                  {agent.error && (
                    <span className="text-xs text-destructive ml-auto">
                      {agent.error}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {generateError && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {generateError}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  )
}
