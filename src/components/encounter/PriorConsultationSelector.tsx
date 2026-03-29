'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { History, ChevronDown, ChevronRight } from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

interface PriorContext {
  encounterId: string
  date: string
  facts: Array<{ id: string; text: string; group: string }>
  diagnosis?: string
}

interface PriorConsultationSelectorProps {
  patientId: string
  currentConsultationId?: string
  onPriorContextChange?: (contexts: PriorContext[]) => void
}

export function PriorConsultationSelector({
  patientId,
  currentConsultationId,
  onPriorContextChange,
}: PriorConsultationSelectorProps) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())

  const priorConsultations = useQuery(
    api.encounters.getPriorConsultations,
    {
      patientId: patientId as Id<"patients">,
      excludeConsultationId: currentConsultationId as Id<"encounters"> | undefined,
    }
  )

  // Notify parent when selection changes
  React.useEffect(() => {
    if (!priorConsultations) return

    const contexts: PriorContext[] = priorConsultations
      .filter((c) => selectedIds.has(c._id))
      .map((c) => ({
        encounterId: c._id,
        date: c.date,
        facts: c.facts,
        diagnosis: c.diagnosis || undefined,
      }))

    onPriorContextChange?.(contexts)
  }, [selectedIds, priorConsultations, onPriorContextChange])

  const toggleSelection = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleExpanded = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  if (!priorConsultations) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Loading prior encounters...
        </CardContent>
      </Card>
    )
  }

  if (priorConsultations.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No prior encounters found for this patient
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Prior Encounter History
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {priorConsultations.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">
          Include findings from prior visits to enrich generated documents.
        </p>
        {priorConsultations.map((encounter) => {
          const isSelected = selectedIds.has(encounter._id)
          const isExpanded = expandedIds.has(encounter._id)

          return (
            <div
              key={encounter._id}
              className={`border rounded-lg p-3 transition-colors ${
                isSelected ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelection(encounter._id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {new Date(encounter.date).toLocaleDateString()}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {encounter.factCount} facts
                    </Badge>
                    {encounter.status && (
                      <Badge
                        variant={encounter.status === 'published' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {encounter.status}
                      </Badge>
                    )}
                  </div>
                  {encounter.diagnosis && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {encounter.diagnosis}
                    </p>
                  )}
                </div>
                {encounter.facts.length > 0 && (
                  <button
                    onClick={() => toggleExpanded(encounter._id)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>

              {isExpanded && encounter.facts.length > 0 && (
                <div className="mt-2 pl-7 space-y-1">
                  {encounter.facts.slice(0, 10).map((fact) => (
                    <div key={fact.id} className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] mr-1.5 py-0">
                        {fact.group}
                      </Badge>
                      {fact.text}
                    </div>
                  ))}
                  {encounter.facts.length > 10 && (
                    <p className="text-xs text-muted-foreground italic">
                      +{encounter.facts.length - 10} more facts
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {selectedIds.size > 0 && (
          <div className="text-xs text-muted-foreground pt-2">
            {selectedIds.size} prior encounter{selectedIds.size !== 1 ? 's' : ''} selected as context
          </div>
        )}
      </CardContent>
    </Card>
  )
}
