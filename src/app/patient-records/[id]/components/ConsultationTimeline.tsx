'use client';

import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Brain, MessageCircle, ArrowRight, Mic } from 'lucide-react';
import type { Id } from 'convex/_generated/dataModel';
import { AppLink } from '@/components/navigation/AppLink';

interface TimelineConsultation {
  _id: Id<'encounters'>;
  date: string;
  createdAt: string;
  diagnosis?: string;
  transcription?: string;
  reasonForVisit?: string;
  status?: string;
  recordingCount?: number;
  documentCount: number;
  factCount: number;
  companion: {
    isActive: boolean;
    messageCount: number;
    accessToken: string;
  } | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

const STATUS_CONFIG: Record<string, { dot: string; badge: string }> = {
  published:    { dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
  'in-progress':{ dot: 'bg-blue-500',  badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  review:       { dot: 'bg-purple-500',badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  draft:        { dot: 'bg-yellow-400',badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
};

export function ConsultationTimeline({
  encounters,
  loading,
}: {
  encounters: TimelineConsultation[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (encounters.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        No encounters recorded yet
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline rail */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-3">
        {encounters.map((c) => {
          const statusCfg = c.status ? (STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft) : STATUS_CONFIG.draft;
          // Prefer reasonForVisit; fall back to a short diagnosis snippet
          const summary = c.reasonForVisit
            || (c.diagnosis ? c.diagnosis.substring(0, 100) + (c.diagnosis.length > 100 ? '…' : '') : null)
            || null;

          return (
            <div key={c._id} className="relative pl-10">
              {/* Timeline dot */}
              <div className={`absolute left-2.5 top-4 h-3 w-3 rounded-full border-2 border-background ${statusCfg.dot}`} />

              <AppLink
                href={`/encounter/${c._id}`}
                className="block border border-border rounded-xl hover:shadow-sm hover:border-primary/30 transition-all bg-card"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Date + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{formatDate(c.date)}</span>
                        <span className="text-xs text-muted-foreground">{formatRelativeDate(c.createdAt)}</span>
                        {c.status && (
                          <Badge variant="outline" className={`text-xs capitalize px-1.5 py-0 ${statusCfg.badge}`}>
                            {c.status === 'in-progress' ? 'In Progress' : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                          </Badge>
                        )}
                      </div>

                      {/* Visit summary */}
                      {summary && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{summary}</p>
                      )}

                      {/* Metadata pills */}
                      <div className="flex items-center gap-3 pt-0.5">
                        {(c.recordingCount ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Mic className="h-3 w-3" />
                            {c.recordingCount} recording{c.recordingCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {c.documentCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            {c.documentCount} doc{c.documentCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {c.factCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Brain className="h-3 w-3" />
                            {c.factCount} fact{c.factCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {c.companion && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MessageCircle className="h-3 w-3" />
                            Companion
                            <span className={`h-1.5 w-1.5 rounded-full ${c.companion.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                </div>
              </AppLink>
            </div>
          );
        })}
      </div>
    </div>
  );
}
