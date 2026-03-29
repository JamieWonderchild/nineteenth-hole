'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2 } from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

interface PatientHistorySearchProps {
  patientId: string
}

export function PatientHistorySearch({ patientId }: PatientHistorySearchProps) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [debouncedTerm, setDebouncedTerm] = React.useState('')

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const results = useQuery(
    api.encounters.searchByPatient,
    debouncedTerm.trim().length >= 2
      ? { patientId: patientId as Id<"patients">, searchTerm: debouncedTerm.trim() }
      : 'skip'
  )

  const isSearching = debouncedTerm.trim().length >= 2 && results === undefined

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search encounters..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {debouncedTerm.trim().length >= 2 && results && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No encounters match &ldquo;{debouncedTerm}&rdquo;
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </p>
              {results.map((result) => result && (
                <div
                  key={result._id}
                  className="border rounded-lg p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {new Date(result.date).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {result.factCount} facts
                      </Badge>
                      {result.status && (
                        <Badge
                          variant={result.status === 'published' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {result.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {result.diagnosis && (
                    <p className="text-xs text-muted-foreground truncate">
                      {result.diagnosis}
                    </p>
                  )}
                  <div className="space-y-1">
                    {result.matchSnippets.map((snippet, i) => (
                      <p key={i} className="text-xs bg-yellow-50 border border-yellow-100 rounded px-2 py-1">
                        {highlightTerm(snippet, debouncedTerm)}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function highlightTerm(text: string, term: string): React.ReactNode {
  const lowerText = text.toLowerCase()
  const lowerTerm = term.toLowerCase()
  const idx = lowerText.indexOf(lowerTerm)

  if (idx === -1) return text

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 rounded px-0.5">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  )
}
