'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Brain,
  Mic,
  Trash2,
  FileBox,
  CalendarClock,
  ArrowRight,
} from 'lucide-react'
import { useAppRouter } from '@/hooks/useAppRouter'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DraftConsultationCardProps {
  encounterId: string
  patientName: string | null
  patientAge?: string | null
  recordingCount: number
  factCount: number
  evidenceCount?: number
  reasonForVisit?: string | null
  appointmentTime?: string | null
  status?: string | null
  createdAt: string
  updatedAt: string
  onDelete?: (encounterId: string) => void
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatAppointmentTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `Today at ${time}`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  if (isTomorrow) return `Tomorrow at ${time}`
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft:        { label: 'Draft',       className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  'in-progress':{ label: 'In Progress', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  review:       { label: 'Review',      className: 'bg-purple-50 text-purple-700 border-purple-200' },
}

export function DraftConsultationCard({
  encounterId,
  patientName,
  patientAge,
  recordingCount,
  factCount,
  evidenceCount,
  reasonForVisit,
  appointmentTime,
  status,
  createdAt,
  updatedAt,
  onDelete,
}: DraftConsultationCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const effectiveStatus = status || 'draft'
  const badge = statusConfig[effectiveStatus] || statusConfig.draft

  const patientSubline = [
    patientAge,
  ].filter(Boolean).join(' · ')

  const router = useAppRouter()

  return (
    <>
      <Card
        className="hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => router.push(`/encounter/${encounterId}`)}
      >
        <CardContent className="p-4 space-y-2.5">
          {/* Header row: status badge + timestamp + delete */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${badge.className}`}>
                {badge.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(updatedAt)}
              </span>
            </div>
            {onDelete && effectiveStatus === 'draft' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Patient */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold truncate">
                {patientName || (
                  <span className="text-muted-foreground font-normal italic">No patient linked</span>
                )}
              </p>
            </div>
            {patientSubline && (
              <p className="text-xs text-muted-foreground truncate">{patientSubline}</p>
            )}
          </div>

          {/* Reason for visit */}
          {reasonForVisit && (
            <p className="text-xs text-muted-foreground truncate">
              {reasonForVisit}
            </p>
          )}

          {/* Footer: metadata + continue */}
          <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
            <div className="flex items-center gap-3 flex-wrap">
              {appointmentTime && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {formatAppointmentTime(appointmentTime)}
                </span>
              )}
              {recordingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Mic className="h-3 w-3" />
                  {recordingCount} {recordingCount === 1 ? 'recording' : 'recordings'}
                </span>
              )}
              {factCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Brain className="h-3 w-3" />
                  {factCount} facts
                </span>
              )}
              {(evidenceCount ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <FileBox className="h-3 w-3" />
                  {evidenceCount} {evidenceCount === 1 ? 'file' : 'files'}
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs text-primary font-medium flex-shrink-0">
              Continue <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this draft encounter
              {patientName ? ` for ${patientName}` : ''} and any associated recordings.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete?.(encounterId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
