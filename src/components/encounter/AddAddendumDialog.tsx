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
import { Loader2, Plus } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from 'convex/_generated/api'
import { useUser } from '@clerk/nextjs'
import { toast } from '@/hooks/use-toast'
import type { Id } from 'convex/_generated/dataModel'

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
  const [text, setText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const addAddendum = useMutation(api.encounters.addAddendum)

  // Fetch current encounter to show existing addenda
  const encounter = useQuery(
    api.encounters.getById,
    open ? { id: encounterId as Id<'encounters'> } : 'skip'
  )

  const existingAddenda = encounter?.addenda || []

  const handleSubmit = async () => {
    if (!user?.id || !text.trim()) return

    setIsSaving(true)
    try {
      await addAddendum({
        encounterId: encounterId as Id<'encounters'>,
        text: text.trim(),
        providerId: user.id,
      })

      setText('')
      toast({ title: 'Addendum added' })
    } catch (error) {
      console.error('Failed to add addendum:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add addendum',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

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
            <Label htmlFor="addendum-text">New Addendum</Label>
            <Textarea
              id="addendum-text"
              placeholder="Add a note, correction, or update..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
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
