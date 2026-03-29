'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Heart, AlertTriangle, Loader2 } from 'lucide-react'
import { CompanionChat } from '@/components/companion/CompanionChat'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionContext {
  patientName: string
  visitSummary: string
  suggestions: string[]
  visitDate?: string
  contextVersion?: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CompanionPage() {
  const params = useParams()
  const accessToken = params.id as string

  const [session, setSession] = React.useState<SessionContext | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch session context on mount
  React.useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch(`/api/companion/${accessToken}`)
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('This companion link is no longer active or does not exist.')
          }
          throw new Error('Unable to load care companion. Please try again.')
        }
        const data = await response.json()
        setSession({
          patientName: data.patientName || 'Your Patient',
          visitSummary: data.visitSummary || '',
          suggestions: data.suggestions || [
            'What medications were prescribed?',
            'What should I watch for at home?',
            'When is the follow-up appointment?',
            'Are there any dietary changes needed?',
          ],
          visitDate: data.visitDate,
          contextVersion: data.contextVersion ?? 0,
        })
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Something went wrong. Please try again.'
        )
      } finally {
        setLoading(false)
      }
    }

    if (accessToken) {
      fetchSession()
    }
  }, [accessToken])

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-amber-50">
        <div className="text-center space-y-4 px-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Heart className="h-8 w-8 text-amber-600 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-amber-900">
              Loading Care Companion
            </h1>
            <div className="flex items-center justify-center gap-2 text-sm text-amber-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing care information...
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !session) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-amber-50 p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            Companion Not Found
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            {error || 'This companion link may have expired or is invalid.'}
          </p>
          <p className="text-xs text-gray-500">
            If you received this link from your physician, please contact them
            for a new one.
          </p>
        </div>
      </div>
    )
  }

  // Main companion page
  return (
    <div className="flex min-h-[100dvh] flex-col bg-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-amber-200 bg-white/90 backdrop-blur-sm px-4 py-3 safe-area-top">
        <div className="mx-auto max-w-lg flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <Heart className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">
              {session.patientName}&apos;s Care Companion
            </h1>
            {session.visitDate && (
              <p className="text-xs text-gray-500">
                Visit: {new Date(session.visitDate).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 flex flex-col mx-auto w-full max-w-lg">
        <CompanionChat
          accessToken={accessToken}
          patientName={session.patientName}
          visitSummary={session.visitSummary}
          suggestions={session.suggestions}
          contextVersion={session.contextVersion}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-200 bg-white/80 px-4 py-3 safe-area-bottom">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-[11px] leading-relaxed text-gray-400">
            Powered by [PRODUCT_NAME] &mdash; This is not a substitute for clinical
            advice. If you are experiencing a medical emergency, contact your
            physician or the nearest emergency department immediately.
          </p>
        </div>
      </footer>
    </div>
  )
}
