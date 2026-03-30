'use client';

import { useMemo, useState } from 'react';
import { Clock, Mic, FileText, AlertCircle, CheckCircle, RefreshCw, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type RecordingData = {
  _id: string;
  _creationTime: number;
  createdAt: string;
  phase?: string;
  duration?: number;
  transcript?: string;
  facts?: Array<{ id: string; text: string; group: string }>;
  interactionId?: string;
};

type ReconciledFact = {
  factId: string;
  text: string;
  group: string;
  status: string; // 'confirmed' | 'updated' | 'contradicted' | 'new' | 'unchanged'
  recordingIndex: number;
  priorFactId?: string;
  priorText?: string;
  priorRecordingIndex?: number;
  resolution?: string; // 'accept-new' | 'keep-old'
  resolvedAt?: string;
};

type FactReconciliation = {
  reconciledFacts: ReconciledFact[];
  summary: {
    confirmed: number;
    updated: number;
    contradicted: number;
    new: number;
    unchanged: number;
  };
  reconciledAt: string;
  triggerRecordingCount: number;
};

interface RecordingTimelineProps {
  recordings: RecordingData[];
  factReconciliation?: FactReconciliation;
  onResolveConflict?: (factId: string, resolution: 'accept-new' | 'keep-old') => void;
}

const phaseConfig: Record<string, { label: string; icon: any; color: string }> = {
  history: {
    label: 'History',
    icon: FileText,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
  },
  exam: {
    label: 'Physical Exam',
    icon: Mic,
    color: 'bg-purple-100 text-purple-700 border-purple-300',
  },
  assessment: {
    label: 'Assessment',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-700 border-green-300',
  },
  'follow-up': {
    label: 'Follow-up',
    icon: RefreshCw,
    color: 'bg-orange-100 text-orange-700 border-orange-300',
  },
};

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  confirmed: {
    icon: CheckCircle,
    color: 'text-green-600',
    label: 'Confirmed',
  },
  updated: {
    icon: RefreshCw,
    color: 'text-blue-600',
    label: 'Updated',
  },
  contradicted: {
    icon: AlertCircle,
    color: 'text-red-600',
    label: 'Contradicted',
  },
  new: {
    icon: Sparkles,
    color: 'text-purple-600',
    label: 'New',
  },
  unchanged: {
    icon: CheckCircle,
    color: 'text-gray-400',
    label: 'Unchanged',
  },
};

export function RecordingTimeline({ recordings, factReconciliation, onResolveConflict }: RecordingTimelineProps) {
  // Track which recordings are expanded
  const [expandedRecordings, setExpandedRecordings] = useState<Set<string>>(new Set());

  const toggleRecording = (recordingId: string) => {
    setExpandedRecordings((prev) => {
      const next = new Set(prev);
      if (next.has(recordingId)) {
        next.delete(recordingId);
      } else {
        next.add(recordingId);
      }
      return next;
    });
  };

  // Group reconciled facts by recording index
  const factsByRecording = useMemo(() => {
    if (!factReconciliation) return new Map<number, ReconciledFact[]>();

    const map = new Map<number, ReconciledFact[]>();
    for (const fact of factReconciliation.reconciledFacts) {
      const existing = map.get(fact.recordingIndex) || [];
      existing.push(fact);
      map.set(fact.recordingIndex, existing);
    }
    return map;
  }, [factReconciliation]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (recordings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mic className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No recordings yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Recording Timeline</h3>
            <Badge variant="outline" className="ml-auto">
              {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            {/* Timeline items */}
            <div className="space-y-8">
              {recordings.map((recording, index) => {
                const phase = phaseConfig[recording.phase || ''] || {
                  label: 'Recording',
                  icon: Mic,
                  color: 'bg-gray-100 text-gray-700 border-gray-300',
                };
                const PhaseIcon = phase.icon;
                const reconciledFacts = factsByRecording.get(index) || [];
                const regularFacts = recording.facts || [];
                const isExpanded = expandedRecordings.has(recording._id);
                const totalFacts = reconciledFacts.length || regularFacts.length;

                // Count fact status changes for this recording
                const statusCounts = reconciledFacts.reduce(
                  (acc, fact) => {
                    acc[fact.status] = (acc[fact.status] || 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>
                );

                return (
                  <div key={recording._id} className="relative pl-14">
                    {/* Timeline node */}
                    <div className="absolute left-0 top-1 h-12 w-12 rounded-full border-4 border-background bg-card flex items-center justify-center z-10">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${phase.color}`}>
                        <PhaseIcon className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Content card */}
                    <Card
                      className="border-2 hover:border-primary/30 transition-colors cursor-pointer"
                      onClick={() => toggleRecording(recording._id)}
                    >
                      <CardContent className="p-4">
                        {/* Header - Always visible */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Expand/collapse icon */}
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-sm">
                                  Recording {index + 1}
                                  {recording.phase && ` - ${phase.label}`}
                                </h4>
                                {recording.duration && (
                                  <Badge variant="secondary" className="text-xs">
                                    {formatDuration(recording.duration)}
                                  </Badge>
                                )}
                                {totalFacts > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {totalFacts} fact{totalFacts !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                <span>{formatTime(recording.createdAt)}</span>
                                <span>·</span>
                                <span>{formatDate(recording.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Fact status badges - Always visible */}
                          {!isExpanded && reconciledFacts.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {Object.entries(statusCounts).map(([status, count]) => {
                                const config = statusConfig[status];
                                if (!config || count === 0) return null;
                                const StatusIcon = config.icon;
                                return (
                                  <Tooltip key={status}>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="gap-1 text-xs cursor-help"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <StatusIcon className={`h-3 w-3 ${config.color}`} />
                                        <span>{count}</span>
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        {count} {config.label.toLowerCase()} fact{count !== 1 ? 's' : ''}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t space-y-4">
                            {/* Facts section */}
                            {reconciledFacts.length > 0 ? (
                              <div className="space-y-2">
                                {reconciledFacts.map((fact) => {
                              const config = statusConfig[fact.status];
                              const StatusIcon = config.icon;
                              const displayText = fact.resolution === 'keep-old' && fact.priorText
                                ? fact.priorText
                                : fact.text;

                              const isUnresolvedConflict = fact.status === 'contradicted' && !fact.resolution;

                              return (
                                <div
                                  key={fact.factId}
                                  className={`flex items-start gap-2 text-sm group ${isUnresolvedConflict ? 'rounded-md border border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 p-2 -mx-2' : ''}`}
                                >
                                  <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-muted-foreground">
                                      <span className="font-medium text-foreground">
                                        {fact.group}:
                                      </span>{' '}
                                      {displayText}
                                    </p>
                                    {fact.status === 'updated' && fact.priorText && (
                                      <p className="text-xs text-muted-foreground/60 mt-0.5 line-through">
                                        Previously: {fact.priorText}
                                      </p>
                                    )}
                                    {fact.status === 'contradicted' && fact.priorText && (
                                      <p className="text-xs mt-0.5">
                                        <span className="text-muted-foreground">Previously: </span>
                                        <span className="font-medium text-foreground">{fact.priorText}</span>
                                      </p>
                                    )}
                                    {isUnresolvedConflict && onResolveConflict && (
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <button
                                          onClick={() => onResolveConflict(fact.factId, 'accept-new')}
                                          className="text-[11px] font-medium px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                        >
                                          Use new
                                        </button>
                                        <button
                                          onClick={() => onResolveConflict(fact.factId, 'keep-old')}
                                          className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                          Keep old
                                        </button>
                                      </div>
                                    )}
                                    {fact.status === 'contradicted' && fact.resolution && (
                                      <p className="text-[11px] text-muted-foreground mt-1">
                                        Resolved: {fact.resolution === 'accept-new' ? 'using new value' : 'keeping old value'}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                              </div>
                            ) : regularFacts.length > 0 ? (
                              <div className="space-y-2">
                                {regularFacts.map((fact) => (
                              <div
                                key={fact.id}
                                className="flex items-start gap-2 text-sm"
                              >
                                <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {fact.group}:
                                  </span>{' '}
                                  {fact.text}
                                </p>
                              </div>
                            ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                No facts extracted
                              </p>
                            )}

                            {/* Full transcript */}
                            {recording.transcript && (
                              <div className="pt-3 border-t">
                                <h5 className="text-xs font-medium text-muted-foreground mb-2">Transcript</h5>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                  {recording.transcript}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary footer */}
          {factReconciliation && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-4 flex-wrap text-xs">
                <span className="text-muted-foreground font-medium">Summary:</span>
                {Object.entries(factReconciliation.summary).map(([status, count]) => {
                  if (count === 0) return null;
                  const config = statusConfig[status];
                  if (!config) return null;
                  const StatusIcon = config.icon;
                  return (
                    <div key={status} className="flex items-center gap-1.5">
                      <StatusIcon className={`h-3.5 w-3.5 ${config.color}`} />
                      <span className="text-muted-foreground">
                        {count} {config.label.toLowerCase()}
                      </span>
                    </div>
                  );
                })}
                <span className="text-muted-foreground ml-auto">
                  Last updated {new Date(factReconciliation.reconciledAt).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
