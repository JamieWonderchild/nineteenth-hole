'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Brain, Layers, List, Pencil, Trash2, Check, X } from 'lucide-react'

// Group display names for fact categories
const GROUP_LABELS: Record<string, string> = {
  'chief-complaint': 'Chief Complaint',
  'history-of-present-illness': 'History of Present Illness',
  'past-medical-history': 'Past Medical History',
  'past-surgical-history': 'Past Surgical History',
  medications: 'Medications',
  allergies: 'Allergies',
  'family-history': 'Family History',
  'social-history': 'Social History',
  'review-of-systems': 'Review of Systems',
  'physical-exam': 'Physical Exam',
  vitals: 'Vitals',
  assessment: 'Assessment',
  plan: 'Plan',
  demographics: 'Patient Info',
  'medical-history': 'Medical History',
}

function getGroupLabel(group: string): string {
  return GROUP_LABELS[group] || group.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function getGroupColors(group: string): { border: string; text: string } {
  const colors: Record<string, { border: string; text: string }> = {
    'chief-complaint':            { border: 'border-l-red-400',    text: 'text-red-700 dark:text-red-300' },
    'history-of-present-illness': { border: 'border-l-orange-400', text: 'text-orange-700 dark:text-orange-300' },
    medications:                  { border: 'border-l-blue-400',   text: 'text-blue-700 dark:text-blue-300' },
    allergies:                    { border: 'border-l-pink-400',   text: 'text-pink-700 dark:text-pink-300' },
    assessment:                   { border: 'border-l-purple-400', text: 'text-purple-700 dark:text-purple-300' },
    plan:                         { border: 'border-l-green-400',  text: 'text-green-700 dark:text-green-300' },
    vitals:                       { border: 'border-l-cyan-400',   text: 'text-cyan-700 dark:text-cyan-300' },
    demographics:                 { border: 'border-l-gray-400',   text: 'text-gray-700 dark:text-gray-300' },
    'physical-exam':              { border: 'border-l-teal-400',   text: 'text-teal-700 dark:text-teal-300' },
    'past-medical-history':       { border: 'border-l-amber-400',  text: 'text-amber-700 dark:text-amber-300' },
  }
  return colors[group] || { border: 'border-l-muted-foreground', text: 'text-muted-foreground' }
}

interface SimpleFact {
  id: string
  text: string
  group: string
}

interface RecordingFacts {
  recordingIndex: number
  phase?: string
  createdAt: string
  facts: SimpleFact[]
}

interface CombinedFactsPanelProps {
  recordings: RecordingFacts[]
  className?: string
  editable?: boolean
  onFactEdit?: (factId: string, newText: string) => void
  onFactDelete?: (factId: string) => void
  isMobile?: boolean
}


function deduplicateAndMergeFacts(recordings: RecordingFacts[]): SimpleFact[] {
  const seen = new Set<string>()
  const merged: SimpleFact[] = []
  for (const rec of recordings) {
    for (const fact of rec.facts) {
      const key = fact.text.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(fact)
      }
    }
  }
  return merged
}

function groupFacts(facts: SimpleFact[]): Record<string, SimpleFact[]> {
  return facts.reduce<Record<string, SimpleFact[]>>((acc, f) => {
    ;(acc[f.group] = acc[f.group] || []).push(f)
    return acc
  }, {})
}

export function CombinedFactsPanel({ recordings, className, editable = false, onFactEdit, onFactDelete, isMobile = false }: CombinedFactsPanelProps) {
  const [view, setView] = React.useState<'merged' | 'by-recording'>('merged')
  const [editingFactId, setEditingFactId] = React.useState<string | null>(null)
  const [editText, setEditText] = React.useState('')

  const mergedFacts = React.useMemo(() => deduplicateAndMergeFacts(recordings), [recordings])
  const groupedFacts = React.useMemo(() => groupFacts(mergedFacts), [mergedFacts])

  const totalFacts = mergedFacts.length

  const handleStartEdit = (fact: SimpleFact) => {
    setEditingFactId(fact.id)
    setEditText(fact.text)
  }

  const handleSaveEdit = () => {
    if (editingFactId && onFactEdit && editText.trim()) {
      onFactEdit(editingFactId, editText.trim())
      setEditingFactId(null)
      setEditText('')
    }
  }

  const handleCancelEdit = () => {
    setEditingFactId(null)
    setEditText('')
  }

  const handleDelete = (factId: string) => {
    if (onFactDelete) {
      onFactDelete(factId)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Combined Facts
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {totalFacts}
            </span>
          </CardTitle>
          {recordings.length > 1 && (
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              <Button
                variant={view === 'merged' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setView('merged')}
              >
                <Layers className="h-3 w-3 mr-1" />
                Merged
              </Button>
              <Button
                variant={view === 'by-recording' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setView('by-recording')}
              >
                <List className="h-3 w-3 mr-1" />
                By Recording
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {recordings.length} recording{recordings.length !== 1 ? 's' : ''} &middot;{' '}
          {totalFacts} unique fact{totalFacts !== 1 ? 's' : ''}
        </p>
      </CardHeader>
      <CardContent>
        {view === 'merged' ? (
          <div className="space-y-3">
            {Object.entries(groupedFacts).map(([group, facts]) => {
              const colors = getGroupColors(group)
              return (
                <div key={group} className={`border-l-[3px] ${colors.border} pl-3 py-1 space-y-1`}>
                  <h5 className={`text-xs font-semibold ${colors.text}`}>
                    {getGroupLabel(group)}
                  </h5>
                  <ul className="space-y-0.5">
                    {facts.map((f) => (
                      <li key={f.id} className="text-sm text-foreground group">
                        {editingFactId === f.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit()
                                if (e.key === 'Escape') handleCancelEdit()
                              }}
                              className="flex-1 h-7 text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className={isMobile ? "h-9 w-9 p-0" : "h-6 w-6 p-0"}
                              onClick={handleSaveEdit}
                            >
                              <Check className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={isMobile ? "h-9 w-9 p-0" : "h-6 w-6 p-0"}
                              onClick={handleCancelEdit}
                            >
                              <X className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex-1">{f.text}</span>
                            {editable && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleStartEdit(f)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(f.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
            {totalFacts === 0 && (
              <p className="text-sm text-muted-foreground">No facts extracted yet</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {recordings.map((rec) => {
              const recGrouped = groupFacts(rec.facts)
              return (
                <div key={rec.recordingIndex} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {rec.recordingIndex + 1}
                    </span>
                    <span className="text-sm font-medium">
                      Recording {rec.recordingIndex + 1}
                    </span>
                    {rec.phase && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {rec.phase}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {rec.facts.length} fact{rec.facts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {Object.entries(recGrouped).map(([group, facts]) => {
                    const colors = getGroupColors(group)
                    return (
                      <div key={group} className={`pl-7 border-l-[3px] ${colors.border} ml-7 py-1 space-y-1`}>
                        <h6 className={`text-[10px] font-semibold ${colors.text}`}>
                          {getGroupLabel(group)}
                        </h6>
                        <ul className="space-y-0.5">
                          {facts.map((f) => (
                            <li key={f.id} className="text-sm text-foreground group">
                              {editingFactId === f.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit()
                                      if (e.key === 'Escape') handleCancelEdit()
                                    }}
                                    className="flex-1 h-7 text-sm"
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={handleSaveEdit}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={handleCancelEdit}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex-1">{f.text}</span>
                                  {editable && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={() => handleStartEdit(f)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(f.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                  {rec.facts.length === 0 && (
                    <p className="text-xs text-muted-foreground pl-7">No facts in this recording</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
