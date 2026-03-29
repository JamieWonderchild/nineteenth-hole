'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import { Send, Heart, AlertTriangle, Calendar, Pill, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface CompanionChatProps {
  accessToken: string
  patientName: string
  visitSummary: string
  suggestions: string[]
  contextVersion?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getSuggestionIcon(suggestion: string) {
  const lower = suggestion.toLowerCase()
  if (lower.includes('medication') || lower.includes('prescri') || lower.includes('drug')) {
    return <Pill className="h-3.5 w-3.5 shrink-0" />
  }
  if (lower.includes('follow') || lower.includes('appointment') || lower.includes('recheck')) {
    return <Calendar className="h-3.5 w-3.5 shrink-0" />
  }
  if (lower.includes('watch') || lower.includes('emergency') || lower.includes('warning')) {
    return <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
  }
  return <Heart className="h-3.5 w-3.5 shrink-0" />
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompanionChat({
  accessToken,
  patientName,
  visitSummary,
  suggestions: initialSuggestions,
  contextVersion,
}: CompanionChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<string[]>(initialSuggestions)

  // Track context version to show "updated" indicator
  const [initialVersion] = React.useState(contextVersion)
  const hasContextUpdate = contextVersion != null && initialVersion != null && contextVersion > initialVersion

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const chatContainerRef = React.useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages update
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const [summaryExpanded, setSummaryExpanded] = React.useState(false)

  const welcomeMessage = `Hi! I'm here to answer any questions about ${patientName || 'your patient'}'s visit today — medications, care instructions, what to watch for at home, anything. What would you like to know?`

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const sendMessage = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      // Add user message
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput('')
      setIsLoading(true)
      setSuggestions([]) // Clear suggestions while loading

      try {
        const response = await fetch(`/api/companion/${accessToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            accessToken,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to get response')
        }

        const data = await response.json()

        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: data.reply || data.message || 'I apologize, but I could not generate a response. Please try rephrasing your question.',
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])

        // Update suggestions if the API returns new ones
        if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions)
        } else {
          // Provide sensible fallback suggestions based on conversation
          setSuggestions([
            `What should I watch for with ${patientName}?`,
            'Can you explain the medications?',
            'When should I schedule a recheck?',
          ])
        }
      } catch {
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content:
            "I'm sorry, I'm having trouble responding right now. Please try again in a moment. If this continues, contact your clinical clinic directly.",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
        setSuggestions(initialSuggestions)
      } finally {
        setIsLoading(false)
      }
    },
    [accessToken, isLoading, messages, patientName, initialSuggestions]
  )

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      sendMessage(input)
    },
    [input, sendMessage]
  )

  const handleSuggestionClick = React.useCallback(
    (suggestion: string) => {
      sendMessage(suggestion)
    },
    [sendMessage]
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage(input)
      }
    },
    [input, sendMessage]
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col">
      {/* Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {/* Visit summary card */}
        {visitSummary && (
          <div className="rounded-2xl border border-amber-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setSummaryExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-50/50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-800">Today's Visit Summary</span>
              {summaryExpanded
                ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
            </button>
            {summaryExpanded && (
              <div className="px-4 pb-4 border-t border-amber-100">
                <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-gray-800 prose-headings:mt-3 prose-headings:mb-1 prose-strong:text-gray-900 pt-3">
                  <ReactMarkdown>{visitSummary}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Welcome message (always shown) */}
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 mt-0.5">
            <Heart className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1 rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-sm border border-amber-100">
            <p className="text-sm text-gray-700 leading-relaxed">{welcomeMessage}</p>
          </div>
        </div>

        {/* Context updated indicator */}
        {hasContextUpdate && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 mx-4 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs">
            <RefreshCw className="h-3 w-3" />
            Visit information has been updated by your provider
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {message.role === 'assistant' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 mt-0.5">
                <Heart className="h-4 w-4 text-amber-600" />
              </div>
            )}
            <div
              className={`
                max-w-[85%] rounded-2xl px-4 py-3 shadow-sm
                ${
                  message.role === 'user'
                    ? 'rounded-tr-md bg-amber-600 text-white'
                    : 'rounded-tl-md bg-white border border-amber-100 text-gray-700'
                }
              `}
            >
              {message.role === 'assistant' ? (
                <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-gray-800 prose-headings:mt-3 prose-headings:mb-1 prose-strong:text-gray-900">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              )}
              <p
                className={`text-[10px] mt-1.5 ${
                  message.role === 'user'
                    ? 'text-amber-200'
                    : 'text-gray-400'
                }`}
              >
                {message.timestamp.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 mt-0.5">
              <Heart className="h-4 w-4 text-amber-600" />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-sm border border-amber-100">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="
                  inline-flex items-center gap-1.5 rounded-full border border-amber-200
                  bg-white px-3 py-1.5 text-xs font-medium text-amber-800
                  shadow-sm transition-all hover:bg-amber-50 hover:border-amber-300
                  hover:shadow active:scale-[0.98]
                "
              >
                {getSuggestionIcon(suggestion)}
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-amber-200 bg-white px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-lg items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${patientName}'s care...`}
            disabled={isLoading}
            className="
              flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5
              text-sm text-gray-900 placeholder:text-gray-400
              focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-2
              focus:ring-amber-200/50
              disabled:opacity-60
            "
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="
              flex h-10 w-10 shrink-0 items-center justify-center rounded-full
              bg-amber-600 text-white shadow-sm
              transition-all hover:bg-amber-700 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-600
            "
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
