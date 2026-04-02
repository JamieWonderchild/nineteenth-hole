'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Mic, Square } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from 'convex/_generated/api'
import { useUser } from '@clerk/nextjs'
import { toast } from '@/hooks/use-toast'
import type { Id } from 'convex/_generated/dataModel'
import { useLanguagePreference } from '@/hooks/useLanguagePreference'
import { useDictation } from '@/hooks/useDictation'
import { AudioLevelIndicator } from './AudioLevelIndicator'
import { extractAndSaveNoteFacts } from '@/lib/noteFactsExtraction'
import { useNoteReconciliation } from '@/hooks/useNoteReconciliation'

interface AddAddendumDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  encounterId: string
}


export function AddAddendumDialog({
  open,
  onOpenChange,
  encounterId,
}: AddAddendumDialogProps) {
  const { user } = useUser()
  const { language } = useLanguagePreference()
  const [text, setText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const addAddendum = useMutation(api.encounters.addAddendum)
  const createRecording = useMutation(api.recordings.createRecording)
  const setAddendumFactCount = useMutation(api.encounters.setAddendumFactCount)
  const { runReconciliation } = useNoteReconciliation(encounterId as Id<'encounters'>)

  const encounter = useQuery(
    api.encounters.getById,
    open ? { id: encounterId as Id<'encounters'> } : 'skip'
  )

  const existingAddenda = encounter?.addenda || []

  const { state: dictState, audioLevel, start: startDictation, stop: stopDictation } = useDictation({
    language,
    onFinalSegment: (segment) => {
      setText((prev) => (prev ? prev + ' ' + segment : segment))
      setInterimText('')
    },
    onInterimSegment: (segment) => {
      setInterimText(segment)
    },
    onEnded: () => {
      setInterimText('')
    },
    onError: (message) => {
      setInterimText('')
      toast({ title: message, variant: 'destructive' })
    },
  })

  const handleMicClick = async () => {
    if (dictState === 'idle') {
      try {
        await startDictation()
      } catch (err: unknown) {
        toast({
          title: 'Could not start recording',
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      }
    } else if (dictState === 'recording') {
      stopDictation()
    }
  }

  const handleSubmit = async () => {
    if (!user?.id || !text.trim()) return

    setIsSaving(true)
    try {
      const result = await addAddendum({
        encounterId: encounterId as Id<'encounters'>,
        text: text.trim(),
        providerId: user.id,
      })
      const noteIndex = result?.noteIndex ?? -1
      extractAndSaveNoteFacts(
        encounterId as Id<'encounters'>, text.trim(), createRecording, runReconciliation,
        noteIndex >= 0 ? (count) => setAddendumFactCount({ encounterId: encounterId as Id<'encounters'>, index: noteIndex, factCount: count }) : undefined,
        language,
      )
      setText('')
      toast({ title: 'Addendum added' })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add addendum',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const isRecording = dictState === 'recording'
  const isConnecting = dictState === 'connecting'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Addendum</DialogTitle>
          <DialogDescription>
            Add a note to this published encounter record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing addenda */}
          {existingAddenda.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Previous Addenda ({existingAddenda.length})
              </Label>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {existingAddenda.map((a, i) => (
                  <div key={i} className="p-2 bg-muted rounded text-sm space-y-0.5">
                    <p>{a.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New addendum */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="addendum-text">New Addendum</Label>
              {/* Mic toggle */}
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isConnecting}
                title={isRecording ? 'Stop dictating' : 'Dictate note'}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  isRecording
                    ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-border'
                }`}
              >
                {isConnecting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isRecording ? (
                  <>
                    <Square className="h-3 w-3 fill-current" />
                    <AudioLevelIndicator level={audioLevel} />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic className="h-3 w-3" />
                    Dictate
                  </>
                )}
              </button>
            </div>
            <Textarea
              id="addendum-text"
              placeholder={isRecording ? 'Listening… speak your note' : 'Add a note, correction, or update...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
            {interimText && (
              <p className="text-xs text-muted-foreground opacity-60 italic px-1">{interimText}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !text.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Addendum
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
