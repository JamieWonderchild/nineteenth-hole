'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Brain,
  Mic,
  FileText,
  MessageCircle,
  Plus,
  Copy,
  Check,
} from 'lucide-react'
import { useAppRouter } from '@/hooks/useAppRouter'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

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
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface PublishedConsultationCardProps {
  encounterId: string
  patientId?: string
  patientName: string | null
  date: string
  publishedAt?: string | null
  recordingCount: number
  factCount: number
  documentCount: number
  hasCompanion: boolean
  companionActive: boolean
  companionAccessToken?: string | null
  addendaCount: number
  reasonForVisit?: string | null
  onAddAddendum?: (encounterId: string) => void
}

export function PublishedConsultationCard({
  encounterId,
  patientId,
  patientName,
  date,
  publishedAt,
  recordingCount,
  factCount,
  documentCount,
  hasCompanion,
  companionActive,
  companionAccessToken,
  addendaCount,
  reasonForVisit,
  onAddAddendum,
}: PublishedConsultationCardProps) {
  const router = useAppRouter()
  const [copied, setCopied] = useState(false)

  const handleCopyCompanionLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!companionAccessToken) return
    const url = `${window.location.origin}/companion/${companionAccessToken}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      toast({ title: 'Link copied', description: 'Companion link copied to clipboard' })
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const displayDate = formatRelativeDate(publishedAt || date)

  return (
    <Card
      className="hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => router.push(`/encounter/${encounterId}`)}
    >
      <CardContent className="p-4 space-y-2.5">
        {/* Header row: published badge + date + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              Published
            </Badge>
            <span className="text-xs text-muted-foreground">{displayDate}</span>
          </div>
          <div className="flex items-center gap-1">
            {hasCompanion && companionAccessToken && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={handleCopyCompanionLink}
                title="Copy companion link"
              >
                {copied
                  ? <Check className="h-3.5 w-3.5 text-green-600" />
                  : <Copy className="h-3.5 w-3.5" />
                }
              </Button>
            )}
            {onAddAddendum && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); onAddAddendum(encounterId) }}
              >
                <Plus className="h-3 w-3" />
                Addendum
              </Button>
            )}
          </div>
        </div>

        {/* Patient */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">
              {patientName || 'Unknown Patient'}
            </p>
          </div>
        </div>

        {/* Reason for visit */}
        {reasonForVisit && (
          <p className="text-xs text-muted-foreground truncate">{reasonForVisit}</p>
        )}

        {/* Footer: metadata */}
        <div className="flex items-center gap-3 flex-wrap pt-1.5 border-t border-border/50">
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
          {documentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              {documentCount} {documentCount === 1 ? 'doc' : 'docs'}
            </span>
          )}
          {addendaCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {addendaCount} {addendaCount === 1 ? 'addendum' : 'addenda'}
            </span>
          )}
          {hasCompanion && (
            <span className={cn(
              'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full',
              companionActive
                ? 'bg-green-50 text-green-700'
                : 'bg-muted text-muted-foreground'
            )}>
              <MessageCircle className="h-3 w-3" />
              {companionActive ? 'Companion active' : 'Companion'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
