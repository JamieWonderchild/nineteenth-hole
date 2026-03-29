'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Upload,
  FileText,
  Image,
  Loader2,
  Trash2,
  Microscope,
  ExternalLink,
} from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

interface EvidenceUploadPanelProps {
  encounterId: string
  userId: string
  onFindingsChange?: (findings: Array<{ id: string; text: string; group: string }>) => void
}

function guessCategory(mimeType: string, fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.includes('lab') || lower.includes('blood') || lower.includes('cbc') || lower.includes('chem')) {
    return 'lab-result'
  }
  if (lower.includes('xray') || lower.includes('x-ray') || lower.includes('radio') || lower.includes('ultrasound')) {
    return 'imaging'
  }
  if (lower.includes('referral') || lower.includes('report')) {
    return 'referral'
  }
  if (mimeType.startsWith('image/')) return 'imaging'
  return 'other'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function EvidenceUploadPanel({
  encounterId,
  userId,
  onFindingsChange,
}: EvidenceUploadPanelProps) {
  const [isUploading, setIsUploading] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const generateUploadUrl = useMutation(api.evidenceFiles.generateUploadUrl)
  const createEvidenceFile = useMutation(api.evidenceFiles.createEvidenceFile)
  const deleteEvidenceFile = useMutation(api.evidenceFiles.deleteEvidenceFile)
  const updateNotes = useMutation(api.evidenceFiles.updateNotes)

  const evidenceFiles = useQuery(
    api.evidenceFiles.getByConsultation,
    { encounterId: encounterId as Id<"encounters"> }
  )

  // Collect notes as findings for downstream document generation
  const notesAsFindings = React.useMemo(() => {
    if (!evidenceFiles) return []
    return evidenceFiles
      .filter((f) => f.notes && f.notes.trim())
      .map((f) => ({
        id: `evidence-note-${f._id}`,
        text: `[${f.category}] ${f.notes!.trim()}`,
        group: f.category === 'imaging' ? 'imaging-finding' : 'lab-result',
      }))
  }, [evidenceFiles])

  // Notify parent when notes change
  React.useEffect(() => {
    onFindingsChange?.(notesAsFindings)
  }, [notesAsFindings, onFindingsChange])

  const handleFileSelect = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)

    try {
      for (const file of Array.from(files)) {
        const uploadUrl = await generateUploadUrl()
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        })

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`)
        }

        const { storageId } = await uploadResponse.json()

        await createEvidenceFile({
          encounterId: encounterId as Id<"encounters">,
          storageId,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          category: guessCategory(file.type, file.name),
          uploadedBy: userId,
        })
      }
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [encounterId, userId, generateUploadUrl, createEvidenceFile])

  const handleDelete = React.useCallback(async (fileId: string) => {
    try {
      await deleteEvidenceFile({ id: fileId as Id<"evidenceFiles"> })
    } catch (err) {
      console.error('Delete error:', err)
    }
  }, [deleteEvidenceFile])

  const handleNotesChange = React.useCallback(async (fileId: string, notes: string) => {
    try {
      await updateNotes({ id: fileId as Id<"evidenceFiles">, notes })
    } catch (err) {
      console.error('Notes update error:', err)
    }
  }, [updateNotes])

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dt = e.dataTransfer
    if (dt.files && dt.files.length > 0) {
      const fakeEvent = { target: { files: dt.files } } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFileSelect(fakeEvent)
    }
  }, [handleFileSelect])

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Microscope className="h-4 w-4" />
          Evidence Files
          {evidenceFiles && evidenceFiles.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {evidenceFiles.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload area */}
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
          />
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Drop lab results, X-rays, or reports here
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, JPEG, PNG up to 10MB
              </p>
            </div>
          )}
        </div>

        {/* File list */}
        {evidenceFiles && evidenceFiles.length > 0 && (
          <div className="space-y-3">
            {evidenceFiles.map((file) => {
              const isImage = file.mimeType.startsWith('image/')

              return (
                <FileRow
                  key={file._id}
                  fileId={file._id}
                  fileName={file.fileName}
                  category={file.category}
                  fileSize={file.fileSize}
                  isImage={isImage}
                  url={file.url}
                  notes={file.notes || ''}
                  onDelete={handleDelete}
                  onNotesChange={handleNotesChange}
                />
              )
            })}
          </div>
        )}

        {/* Summary */}
        {notesAsFindings.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {notesAsFindings.length} noted finding{notesAsFindings.length !== 1 ? 's' : ''} will be included in documents
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Separate component to avoid re-rendering all files on every keystroke
function FileRow({
  fileId,
  fileName,
  category,
  fileSize,
  isImage,
  url,
  notes: initialNotes,
  onDelete,
  onNotesChange,
}: {
  fileId: string
  fileName: string
  category: string
  fileSize: number
  isImage: boolean
  url: string | null
  notes: string
  onDelete: (fileId: string) => void
  onNotesChange: (fileId: string, notes: string) => void
}) {
  const [localNotes, setLocalNotes] = React.useState(initialNotes)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)

  // Sync from server when it changes
  React.useEffect(() => {
    setLocalNotes(initialNotes)
  }, [initialNotes])

  const handleNotesInput = React.useCallback((value: string) => {
    setLocalNotes(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onNotesChange(fileId, value)
    }, 500)
  }, [fileId, onNotesChange])

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        {isImage ? (
          <Image className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm font-medium flex-1 truncate">
          {fileName}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatFileSize(fileSize)}
        </span>
        <Badge variant="outline" className="text-xs capitalize">
          {category}
        </Badge>
        {url && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(url, '_blank')}
            title="Open file"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onDelete(fileId)}
          title="Delete file"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
      <Input
        placeholder="Add notes (e.g., CBC - elevated BUN/creatinine, suspect renal)"
        value={localNotes}
        onChange={(e) => handleNotesInput(e.target.value)}
        className="text-xs h-8"
      />
    </div>
  )
}
