'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Send, BrainCircuit, Loader2, Stethoscope, Pill, FlaskConical, BookOpen, ClipboardList, FileText, HelpCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isError?: boolean;
  isContext?: boolean;
  createdAt?: string;
}

export interface ClinicalChatProps {
  encounterId?: string;
  patientName?: string;
  factCount?: number;
  sessionId: string | null;
  onSessionCreated: (id: string) => void;
  providerId: string;
  orgId?: Id<'organizations'>;
}

// ---------------------------------------------------------------------------
// Starter prompts — always visible
// ---------------------------------------------------------------------------

const STARTER_PROMPTS = [
  { label: 'Top differentials', prompt: 'What are the top differential diagnoses for this case and why?', icon: Stethoscope, requiresCase: true },
  { label: 'Drug interactions', prompt: 'Are there any potential drug interactions or contraindications I should be aware of?', icon: Pill, requiresCase: true },
  { label: 'Diagnostic plan', prompt: 'What diagnostic tests would you recommend next and in what order?', icon: FlaskConical, requiresCase: true },
  { label: 'Summarize findings', prompt: 'Summarize the key clinical findings and their significance.', icon: ClipboardList, requiresCase: true },
  { label: 'Literature review', prompt: 'What does the recent clinical literature say about this presentation?', icon: BookOpen, requiresCase: true },
  { label: 'Drug calculator', prompt: 'I need help calculating a drug dose.', icon: Pill, requiresCase: false },
  { label: 'General question', prompt: '', icon: HelpCircle, requiresCase: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClinicalChat({ encounterId, patientName, factCount, sessionId, onSessionCreated, providerId, orgId }: ClinicalChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingStatus, setLoadingStatus] = React.useState('Thinking...');
  const [agentId, setAgentId] = React.useState<string | undefined>();
  const [contextId, setContextId] = React.useState<string | undefined>();
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(sessionId);
  const [initialized, setInitialized] = React.useState(false);

  // Streaming text animation
  const [streamingMessageId, setStreamingMessageId] = React.useState<string | null>(null);
  const [streamedText, setStreamedText] = React.useState<string>('');
  const animationFrameRef = React.useRef<number | null>(null);
  const fullTextRef = React.useRef<string>('');

  // Track encounterId changes for mid-chat context injection
  const prevConsultationIdRef = React.useRef<string | undefined>(encounterId);

  // Streaming animation effect
  React.useEffect(() => {
    if (!streamingMessageId || !fullTextRef.current) return;

    const fullText = fullTextRef.current;
    const charsPerFrame = 3; // Characters to reveal per frame (adjust for speed)
    let currentIndex = 0;
    let lastTimestamp = performance.now();

    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastTimestamp;

      // Aim for ~60fps, reveal chars every 16ms
      if (elapsed >= 16) {
        currentIndex = Math.min(currentIndex + charsPerFrame, fullText.length);
        setStreamedText(fullText.slice(0, currentIndex));
        lastTimestamp = timestamp;

        if (currentIndex >= fullText.length) {
          // Animation complete
          setStreamingMessageId(null);
          fullTextRef.current = '';
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [streamingMessageId]);

  // Skip animation handler
  const handleSkipAnimation = React.useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamingMessageId && fullTextRef.current) {
      setStreamedText(fullTextRef.current);
      setStreamingMessageId(null);
      fullTextRef.current = '';
    }
  }, [streamingMessageId]);

  // Track sessionId changes to detect when user clicks a different session
  const prevSessionIdRef = React.useRef<string | null>(sessionId);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Convex mutations
  const createSession = useMutation(api.caseReasoningSessions.createSession);
  const appendMessage = useMutation(api.caseReasoningSessions.appendMessage);
  const updateCortiIds = useMutation(api.caseReasoningSessions.updateCortiIds);
  const updateTitle = useMutation(api.caseReasoningSessions.updateTitle);
  const linkConsultation = useMutation(api.caseReasoningSessions.linkConsultation);

  // Load existing session
  const existingSession = useQuery(
    api.caseReasoningSessions.getSession,
    currentSessionId ? { id: currentSessionId as Id<'caseReasoningSessions'> } : 'skip'
  );

  // Initialize from existing session (resets when sessionId prop changes)
  React.useEffect(() => {
    console.log('[ClinicalChat] Init effect running:', {
      sessionIdProp: sessionId,
      currentSessionId,
      hasExistingSession: !!existingSession,
      existingSessionId: existingSession?._id,
      initialized,
      messageCount: existingSession?.messages?.length
    });

    // Detect sessionId prop change
    const sessionChanged = prevSessionIdRef.current !== sessionId;
    prevSessionIdRef.current = sessionId;

    // Reset initialized flag when sessionId changes
    if (sessionChanged) {
      console.log('[ClinicalChat] 🔄 Session prop changed:', { from: prevSessionIdRef.current, to: sessionId, encounter: encounterId });
      setInitialized(false);
      setCurrentSessionId(sessionId);
      return; // Let next effect run with updated currentSessionId
    }

    // Skip if already initialized and session hasn't changed
    if (initialized && !sessionChanged) {
      console.log('[ClinicalChat] ⏭️ Skipping: already initialized, no session change');
      return;
    }

    if (currentSessionId && existingSession) {
      console.log('[ClinicalChat] 📂 Loading session:', currentSessionId, 'with', existingSession.messages.length, 'messages');
      setMessages(existingSession.messages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        isError: m.isError,
        createdAt: m.createdAt,
      })));
      if (existingSession.cortiAgentId) setAgentId(existingSession.cortiAgentId);
      // RE-ENABLED: Testing if contextId works without expert
      if (existingSession.cortiContextId) setContextId(existingSession.cortiContextId);
      setInitialized(true);
    } else if (!currentSessionId && !sessionId) {
      console.log('[ClinicalChat] 🏠 No session, showing landing page');
      setMessages([]);
      setAgentId(undefined);
      setContextId(undefined);
      setInitialized(true);
    } else {
      console.log('[ClinicalChat] ⏳ Waiting for session data...', { currentSessionId, hasQuery: !!existingSession });
    }
  }, [sessionId, currentSessionId, existingSession, initialized, encounterId]);

  // Mid-chat context injection when encounterId changes
  React.useEffect(() => {
    const prev = prevConsultationIdRef.current;
    prevConsultationIdRef.current = encounterId;

    // Only inject when encounterId changes FROM something else to a new value,
    // AND we already have messages (mid-chat)
    if (!encounterId || encounterId === prev) return;

    if (messages.length === 0) {
      console.log('[ClinicalChat] 🆕 Encounter changed but no messages, showing fresh state:', { from: prev, to: encounterId });
      return;
    }

    console.log('[ClinicalChat] 💉 Injecting new encounter context mid-chat:', { from: prev, to: encounterId });

    const injectContext = async () => {
      // Link the encounter to the session in DB
      if (currentSessionId) {
        try {
          await linkConsultation({
            sessionId: currentSessionId as Id<'caseReasoningSessions'>,
            encounterId: encounterId as Id<'encounters'>,
          });
        } catch (err) {
          console.error('[ClinicalChat] Failed to link encounter:', err);
        }
      }

      // Add a visual context injection message
      const contextLabel = patientName
        ? `Context loaded: ${factCount || 0} facts from ${patientName}'s encounter`
        : `Context loaded: ${factCount || 0} facts from encounter`;

      const contextMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: contextLabel,
        isContext: true,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, contextMsg]);

      // Persist the context message
      if (currentSessionId) {
        try {
          await appendMessage({
            sessionId: currentSessionId as Id<'caseReasoningSessions'>,
            message: {
              id: contextMsg.id,
              role: contextMsg.role,
              content: contextMsg.content,
              createdAt: contextMsg.createdAt!,
            },
          });
        } catch (err) {
          console.error('[ClinicalChat] Failed to persist context message:', err);
        }
      }

      // Send a hidden context message to the Corti agent so it has the clinical data
      if (agentId) {
        try {
          await fetch('/api/case-reasoning/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              encounterId,
              message: `[CONTEXT UPDATE] A encounter has been attached to this conversation. Please incorporate the clinical facts from this encounter into your reasoning going forward. Acknowledge briefly.`,
              agentId,
              contextId,  // RE-ENABLED: Testing if contextId works without expert
            }),
          });
        } catch (err) {
          console.error('[ClinicalChat] Failed to send context update to agent:', err);
        }
      }
    };

    injectContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId]);

  const hasMessages = messages.length > 0 || isLoading;

  // Scroll to bottom on new messages or streaming text
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamedText]);

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const sendMessage = React.useCallback(
    async (text: string) => {
      console.log('[ClinicalChat] sendMessage called with:', text.slice(0, 50));
      const trimmed = text.trim();
      if (!trimmed || isLoading) {
        console.log('[ClinicalChat] sendMessage early return - empty:', !trimmed, 'loading:', isLoading);
        return;
      }

      // Complete any ongoing streaming animation
      if (streamingMessageId) {
        handleSkipAnimation();
      }

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      console.log('[ClinicalChat] Adding user message and setting loading state');
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      setLoadingStatus('Thinking...');

      // Progressive loading status messages (optimized for 60s max)
      const statusMessages = [
        { delay: 0, message: 'Thinking...' },
        { delay: 3000, message: 'Formulating response...' },
        { delay: 8000, message: 'Consulting experts...' },
        { delay: 15000, message: 'Searching clinical literature...' },
        { delay: 25000, message: 'Reviewing clinical guidelines...' },
        { delay: 40000, message: 'Synthesizing evidence...' },
        { delay: 50000, message: 'Almost there...' },
      ];

      const statusTimers: NodeJS.Timeout[] = [];
      statusMessages.forEach(({ delay, message }) => {
        const timer = setTimeout(() => setLoadingStatus(message), delay);
        statusTimers.push(timer);
      });

      // Create session on first message if needed
      let sid = currentSessionId;
      let isNewSession = false;
      if (!sid) {
        try {
          sid = await createSession({
            ...(encounterId && { encounterId: encounterId as Id<'encounters'> }),
            providerId,
            orgId,
          });
          setCurrentSessionId(sid);
          isNewSession = true; // Track that we created a new session

          // Auto-title from first message
          const title = trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed;
          const starterMatch = STARTER_PROMPTS.find(s => s.prompt === trimmed);
          await updateTitle({
            sessionId: sid as Id<'caseReasoningSessions'>,
            title: starterMatch?.label || title,
          });
        } catch (err) {
          console.error('[ClinicalChat] Failed to create session:', err);
        }
      }

      // Persist user message
      if (sid) {
        try {
          await appendMessage({
            sessionId: sid as Id<'caseReasoningSessions'>,
            message: {
              id: userMessage.id,
              role: userMessage.role,
              content: userMessage.content,
              createdAt: userMessage.createdAt!,
            },
          });
        } catch (err) {
          console.error('[ClinicalChat] Failed to persist user message:', err);
        }
      }

      try {
        console.log('[ClinicalChat] Starting fetch request to /api/case-reasoning/chat');
        // Add client-side timeout (slightly longer than server max)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 65000); // 65s (server is 60s max on Hobby plan)

        console.log('[ClinicalChat] Sending fetch with encounterId:', encounterId, 'agentId:', agentId, 'contextId:', contextId);
        const response = await fetch('/api/case-reasoning/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(encounterId && { encounterId }),
            message: trimmed,
            agentId,
            contextId,  // ← RE-ENABLED: Testing if contextId works without expert
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('[ClinicalChat] Fetch completed with status:', response.status, response.ok ? 'OK' : 'ERROR');

        // Read response body ONCE as text, then try parsing
        const responseText = await response.text();
        console.log('[ClinicalChat] Response text length:', responseText.length);

        // Check response status and parse
        if (!response.ok) {
          let errorMessage = 'Failed to get response';
          try {
            const data = JSON.parse(responseText);
            errorMessage = data.details || data.error || errorMessage;
          } catch (jsonError) {
            // Response is not JSON (HTML error page)
            console.error('[ClinicalChat] Non-JSON error response:', responseText.substring(0, 200));
            errorMessage = `Server error (${response.status})`;
          }
          console.error('[ClinicalChat] API error:', response.status, errorMessage);
          throw new Error(errorMessage);
        }

        const data = JSON.parse(responseText);

        if (data.agentId) setAgentId(data.agentId);
        // RE-ENABLED: Testing if contextId works without expert
        if (data.contextId) setContextId(data.contextId);

        // Persist Corti IDs
        if (sid && (data.agentId || data.contextId)) {
          try {
            await updateCortiIds({
              sessionId: sid as Id<'caseReasoningSessions'>,
              cortiAgentId: data.agentId,
              cortiContextId: data.contextId,
            });
          } catch (err) {
            console.error('[ClinicalChat] Failed to persist Corti IDs:', err);
          }
        }

        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: data.message || 'I could not generate a response. Please try rephrasing.',
          createdAt: new Date().toISOString(),
        };

        // Start streaming animation
        fullTextRef.current = assistantMessage.content;
        setStreamingMessageId(assistantMessage.id);
        setStreamedText('');

        setMessages((prev) => [...prev, assistantMessage]);

        // Persist assistant message
        if (sid) {
          try {
            await appendMessage({
              sessionId: sid as Id<'caseReasoningSessions'>,
              message: {
                id: assistantMessage.id,
                role: assistantMessage.role,
                content: assistantMessage.content,
                createdAt: assistantMessage.createdAt!,
              },
            });
          } catch (err) {
            console.error('[ClinicalChat] Failed to persist assistant message:', err);
          }
        }

        // Notify parent of new session AFTER messages are persisted
        if (isNewSession && sid) {
          onSessionCreated(sid);
        }
      } catch (err) {
        let errMsg = 'Unknown error';

        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            errMsg = 'Request timed out after 60 seconds. The AI is taking longer than expected researching your question. Please try again or simplify your question.';
          } else {
            errMsg = err.message;
          }
        }

        console.error('[ClinicalChat] Error:', errMsg, err);
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Something went wrong. ${errMsg}`,
          isError: true,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);

        // Persist error message
        if (sid) {
          try {
            await appendMessage({
              sessionId: sid as Id<'caseReasoningSessions'>,
              message: {
                id: errorMessage.id,
                role: errorMessage.role,
                content: errorMessage.content,
                isError: true,
                createdAt: errorMessage.createdAt!,
              },
            });
          } catch (err2) {
            console.error('[ClinicalChat] Failed to persist error message:', err2);
          }
        }

        // Notify parent of new session AFTER error message is persisted
        if (isNewSession && sid) {
          onSessionCreated(sid);
        }
      } finally {
        // Clear all status update timers
        statusTimers.forEach(timer => clearTimeout(timer));
        setIsLoading(false);
      }
    },
    [encounterId, isLoading, agentId, contextId, currentSessionId, providerId, orgId, createSession, appendMessage, updateCortiIds, updateTitle, onSessionCreated, streamingMessageId, handleSkipAnimation]
  );

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [input, sendMessage]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage]
  );

  // ---------------------------------------------------------------------------
  // Starter pills — filtered by whether we have case context
  // ---------------------------------------------------------------------------

  const visiblePills = React.useMemo(() => {
    if (encounterId && factCount) {
      // Show case-specific pills
      return STARTER_PROMPTS.filter(s => s.requiresCase);
    }
    // General mode — show only general pills
    return STARTER_PROMPTS.filter(s => !s.requiresCase);
  }, [encounterId, factCount]);

  const starterPillsRow = (compact: boolean) => (
    <div className={`flex flex-wrap ${compact ? 'justify-start' : 'justify-center'} gap-2`}>
      {visiblePills.map((s) => {
        if (s.label === 'General question') return null; // Placeholder, not clickable
        const Icon = s.icon;
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => sendMessage(s.prompt)}
            disabled={isLoading}
            className={`
              inline-flex items-center gap-1.5 rounded-full border bg-background shadow-sm
              ${compact ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'}
              font-medium text-foreground
              transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md
              active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed
            `}
          >
            <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            {s.label}
          </button>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Context badge
  // ---------------------------------------------------------------------------

  const contextBadge = encounterId && factCount ? (
    <div className="inline-flex items-center justify-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-xs shadow-sm">
      <FileText className="h-3.5 w-3.5 text-primary" />
      <span className="text-foreground">
        <span className="font-semibold">{factCount} facts</span> from {patientName || 'encounter'}
      </span>
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // Input bar
  // ---------------------------------------------------------------------------

  const placeholderText = encounterId && patientName
    ? `Ask about ${patientName}'s case...`
    : 'Ask any clinical question...';

  const inputBar = (
    <form onSubmit={handleSubmit} className="relative flex items-center">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholderText}
        disabled={isLoading}
        className="
          w-full rounded-full border-2 bg-background pl-5 pr-14 py-3
          text-sm text-foreground placeholder:text-muted-foreground
          shadow-sm
          focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:shadow-md
          disabled:opacity-60 disabled:cursor-not-allowed
          transition-all
        "
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="
          absolute right-2 flex h-9 w-9 items-center justify-center rounded-full
          bg-primary text-primary-foreground shadow-md shadow-primary/30
          transition-all hover:bg-primary/90 hover:shadow-lg active:scale-95
          disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none
        "
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );

  // ---------------------------------------------------------------------------
  // Landing state (no messages)
  // ---------------------------------------------------------------------------

  if (!hasMessages) {
    return (
      <div className="flex flex-1 flex-col bg-gradient-to-b from-muted/20 to-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg space-y-6 px-4">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-4 ring-primary/20">
                  <BrainCircuit className="h-8 w-8 text-primary" />
                </div>
              </div>
              {contextBadge ? (
                <div className="flex justify-center">
                  {contextBadge}
                </div>
              ) : (
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">Clinical Reasoning Assistant</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask any clinical question, or select a case for context
                  </p>
                </div>
              )}
            </div>

            {starterPillsRow(false)}
            {inputBar}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Conversation state
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col h-full bg-gradient-to-b from-muted/20 to-background">
      {/* Header with patient info */}
      {(patientName || encounterId) && (
        <div className="shrink-0 border-b bg-card/50 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-base text-foreground truncate">
                {patientName ? `${patientName}'s Case` : 'Clinical Case Review'}
              </h2>
              {factCount && (
                <p className="text-xs text-muted-foreground">
                  {factCount} clinical facts available
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-6 space-y-4 min-h-0">
        {messages.map((message) => {
          // Context injection message — styled differently
          if (message.isContext) {
            return (
              <div key={message.id} className="flex justify-center py-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-xs text-primary font-medium shadow-sm">
                  <FileText className="h-3.5 w-3.5" />
                  {message.content}
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5 ring-2 ${message.isError ? 'bg-destructive/10 ring-destructive/20' : 'bg-primary/10 ring-primary/20'}`}>
                  <BrainCircuit className={`h-4 w-4 ${message.isError ? 'text-destructive' : 'text-primary'}`} />
                </div>
              )}
              <div className="flex-1 flex flex-col gap-2">
                <div
                  className={`
                    rounded-2xl px-4 py-3 shadow-sm
                    ${
                      message.role === 'user'
                        ? 'rounded-br-md bg-primary text-primary-foreground shadow-primary/20'
                        : message.isError
                          ? 'rounded-bl-md bg-destructive/5 text-destructive border border-destructive/20 shadow-destructive/10'
                          : 'rounded-bl-md bg-card border border-border/50 shadow-md'
                    }
                  `}
                >
                  {message.role === 'assistant' ? (
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-1 prose-h1:text-base prose-h1:font-bold prose-h2:text-sm prose-h2:font-bold prose-h3:text-sm prose-h3:font-semibold prose-strong:text-foreground prose-code:text-foreground prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-table:w-full prose-table:border-collapse prose-table:text-xs prose-table:my-2 prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-semibold prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingMessageId === message.id ? streamedText : message.content}
                      </ReactMarkdown>
                      {streamingMessageId === message.id && (
                        <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5" />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                  )}
                </div>
                {streamingMessageId === message.id && (
                  <button
                    onClick={handleSkipAnimation}
                    className="self-start px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors flex items-center gap-1.5 border border-border/50"
                  >
                    <span>Show all</span>
                    <span className="text-[10px]">↓</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20 mt-0.5">
              <BrainCircuit className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-2xl rounded-bl-md bg-card border border-border/50 shadow-md px-4 py-3">
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs font-medium">{loadingStatus}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer: persistent pills + context badge + input */}
      <div className="shrink-0 px-2 sm:px-4 py-4 border-t bg-card/50 backdrop-blur-sm space-y-3">
        {contextBadge}
        {starterPillsRow(true)}
        {inputBar}
      </div>
    </div>
  );
}
