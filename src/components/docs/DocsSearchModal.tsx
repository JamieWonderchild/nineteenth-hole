'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, X, ArrowRight, Loader2 } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { getArticleBySlug } from '@/content/docs';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface DocsSearchModalProps {
  open: boolean;
  onClose: () => void;
}

// ============================================================================
// SUGGESTED QUESTIONS
// ============================================================================

const SUGGESTED_QUESTIONS = [
  'How do I record a encounter?',
  'What are clinical facts?',
  'How does document generation work?',
  'How does billing work?',
  'What is the Patient Companion?',
];

// ============================================================================
// COMPONENT
// ============================================================================

export function DocsSearchModal({ open, onClose }: DocsSearchModalProps) {
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [agentId, setAgentId] = React.useState<string | undefined>();
  const [contextId, setContextId] = React.useState<string | undefined>();
  const [suggestedSlugs, setSuggestedSlugs] = React.useState<string[]>([]);

  // Streaming animation
  const [streamingId, setStreamingId] = React.useState<string | null>(null);
  const [streamedText, setStreamedText] = React.useState('');
  const animFrameRef = React.useRef<number | null>(null);
  const fullTextRef = React.useRef('');

  const inputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // Reset on close
      setInput('');
      setMessages([]);
      setAgentId(undefined);
      setContextId(undefined);
      setSuggestedSlugs([]);
      setStreamingId(null);
      setStreamedText('');
    }
  }, [open]);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedText]);

  // Text reveal animation
  React.useEffect(() => {
    if (!streamingId || !fullTextRef.current) return;

    const fullText = fullTextRef.current;
    const charsPerFrame = 3;
    let currentIndex = 0;

    const animate = () => {
      currentIndex = Math.min(currentIndex + charsPerFrame, fullText.length);
      setStreamedText(fullText.slice(0, currentIndex));

      if (currentIndex < fullText.length) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
        setStreamingId(null);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [streamingId]);

  const skipAnimation = React.useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamingId && fullTextRef.current) {
      setStreamedText(fullTextRef.current);
      setStreamingId(null);
    }
  }, [streamingId]);

  const sendMessage = React.useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;

    // Complete any ongoing animation
    if (streamingId) skipAnimation();

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setSuggestedSlugs([]);

    try {
      const res = await fetch('/api/docs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          agentId,
          contextId,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      // Persist agent for follow-up turns
      if (data.agentId) setAgentId(data.agentId);
      if (data.contextId) setContextId(data.contextId);
      if (data.suggestedSlugs?.length) setSuggestedSlugs(data.suggestedSlugs);

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Start text reveal animation
      fullTextRef.current = data.message;
      setStreamingId(assistantMsg.id);
      setStreamedText('');
    } catch (err) {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, contextId, isLoading, skipAnimation, streamingId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  const hasMessages = messages.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[75vh] overflow-hidden">

        {/* Search input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about [PRODUCT_NAME]..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!hasMessages ? (
            /* Suggested questions */
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-3">Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-sm px-3 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors text-muted-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3">Browse documentation</p>
                <AppLink
                  href="/docs"
                  onClick={onClose}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  View all articles <ArrowRight className="h-3.5 w-3.5" />
                </AppLink>
              </div>
            </div>
          ) : (
            /* Chat messages */
            <div className="p-4 space-y-4">
              {messages.map(message => {
                const isStreaming = streamingId === message.id;
                const displayText = isStreaming ? streamedText : message.content;

                return (
                  <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : ''}>
                    {message.role === 'user' ? (
                      <div className="max-w-[80%] bg-primary/10 text-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
                        {message.content}
                      </div>
                    ) : (
                      <div
                        className="text-sm text-foreground cursor-pointer"
                        onClick={() => isStreaming && skipAnimation()}
                      >
                        <div className="prose prose-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
                        </div>
                        {isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 bg-primary/60 animate-pulse ml-0.5 align-text-bottom" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Searching documentation...</span>
                </div>
              )}

              {/* Suggested article links */}
              {suggestedSlugs.length > 0 && !isLoading && (
                <div className="space-y-1.5">
                  {suggestedSlugs.map(slug => {
                    const article = getArticleBySlug(slug);
                    if (!article) return null;
                    return (
                      <AppLink
                        key={slug}
                        href={`/docs/${slug}`}
                        onClick={onClose}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors group"
                      >
                        <div>
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">
                            {article.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{article.description}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </AppLink>
                    );
                  })}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border shrink-0 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {hasMessages ? 'Ask a follow-up question above' : 'Type a question or pick one above'}
          </span>
          <kbd className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>
      </div>
    </div>
  );
}
