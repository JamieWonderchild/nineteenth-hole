"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles } from "lucide-react"

interface SimpleFact {
  id: string
  text: string
  group: string
  isDiscarded?: boolean
}

interface LiveFactsPanelProps {
  facts: SimpleFact[]
  isRecording: boolean
}

// Group display names for fact categories
const GROUP_LABELS: Record<string, string> = {
  "chief-complaint": "Chief Complaint",
  "history-of-present-illness": "History of Present Illness",
  "past-medical-history": "Past Medical History",
  "past-surgical-history": "Past Surgical History",
  medications: "Medications",
  allergies: "Allergies",
  "family-history": "Family History",
  "social-history": "Social History",
  "review-of-systems": "Review of Systems",
  "physical-exam": "Physical Exam",
  vitals: "Vitals",
  assessment: "Assessment",
  plan: "Plan",
  demographics: "Patient Info",
  "medical-history": "Medical History",
}

function getGroupLabel(group: string): string {
  return GROUP_LABELS[group] || group.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// Border + text color per category
function getGroupColors(group: string): { border: string; text: string } {
  const colors: Record<string, { border: string; text: string }> = {
    "chief-complaint":           { border: "border-l-red-400",    text: "text-red-700 dark:text-red-300" },
    "history-of-present-illness":{ border: "border-l-orange-400", text: "text-orange-700 dark:text-orange-300" },
    medications:                 { border: "border-l-blue-400",   text: "text-blue-700 dark:text-blue-300" },
    allergies:                   { border: "border-l-pink-400",   text: "text-pink-700 dark:text-pink-300" },
    assessment:                  { border: "border-l-purple-400", text: "text-purple-700 dark:text-purple-300" },
    plan:                        { border: "border-l-green-400",  text: "text-green-700 dark:text-green-300" },
    vitals:                      { border: "border-l-cyan-400",   text: "text-cyan-700 dark:text-cyan-300" },
    demographics:                { border: "border-l-gray-400",   text: "text-gray-700 dark:text-gray-300" },
    "physical-exam":             { border: "border-l-teal-400",   text: "text-teal-700 dark:text-teal-300" },
    "past-medical-history":      { border: "border-l-amber-400",  text: "text-amber-700 dark:text-amber-300" },
  }
  return colors[group] || { border: "border-l-muted-foreground", text: "text-muted-foreground" }
}

export function LiveFactsPanel({ facts, isRecording }: LiveFactsPanelProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const renderedIdsRef = React.useRef<Set<string>>(new Set())

  // Group facts by category with text-based deduplication
  const groupedFacts = React.useMemo(() => {
    const groups: Record<string, SimpleFact[]> = {}
    const seenTexts = new Set<string>()

    facts.forEach((fact) => {
      if (!fact.isDiscarded) {
        const normalizedText = fact.text.toLowerCase().trim()
        if (seenTexts.has(normalizedText)) {
          return
        }
        seenTexts.add(normalizedText)

        if (!groups[fact.group]) {
          groups[fact.group] = []
        }
        groups[fact.group].push(fact)
      }
    })
    return groups
  }, [facts])

  // Auto-scroll to bottom when new facts arrive
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [facts])

  // Track which IDs have been rendered (for animation)
  React.useEffect(() => {
    facts.forEach((f) => {
      if (!f.isDiscarded) {
        renderedIdsRef.current.add(f.id)
      }
    })
  }, [facts])

  // Count unique facts (deduplicated)
  const totalFacts = React.useMemo(() => {
    const seenTexts = new Set<string>()
    return facts.filter((f) => {
      if (f.isDiscarded) return false
      const normalizedText = f.text.toLowerCase().trim()
      if (seenTexts.has(normalizedText)) return false
      seenTexts.add(normalizedText)
      return true
    }).length
  }, [facts])

  return (
    <Card className="flex flex-col h-full">
      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Clinical Facts
          </span>
          {totalFacts > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {totalFacts} extracted
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto space-y-3 pr-1">
          {totalFacts === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-muted-foreground text-sm">
              {isRecording
                ? "Facts will appear here as they are extracted from the conversation."
                : "Start recording to see extracted clinical facts."}
            </div>
          ) : (
            Object.entries(groupedFacts).map(([group, groupFacts]) => {
              const colors = getGroupColors(group)
              return (
                <div key={group} className={`border-l-[3px] ${colors.border} pl-3 py-1 space-y-1`}>
                  <h4 className={`text-xs font-semibold ${colors.text}`}>
                    {getGroupLabel(group)}
                  </h4>
                  <ul className="space-y-0.5">
                    {groupFacts.map((fact) => {
                      const isNew = !renderedIdsRef.current.has(fact.id)
                      return (
                        <li
                          key={fact.id}
                          className={`text-sm text-foreground ${isNew ? "animate-slideIn" : ""}`}
                        >
                          {fact.text}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
