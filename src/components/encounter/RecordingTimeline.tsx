'use client';

import { useMemo, useState, useEffect } from 'react';
import { Clock, Mic, FileText, AlertCircle, CheckCircle, RefreshCw, Sparkles, ChevronDown, ChevronRight, AlertTriangle, Pencil } from 'lucide-react';
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

type AddendumData = {
  text: string;
  createdAt: string;
  factCount?: number;
};

type ReconciledFact = {
  factId: string;
  text: string;
  group: string;
  status: string;
  recordingIndex: number;
  priorFactId?: string;
  priorText?: string;
  priorRecordingIndex?: number;
  resolution?: string;
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
  addenda?: AddendumData[];
  onEditNote?: (index: number, text: string, createdAt: string) => void;
  isEditable?: boolean;
}

type TimelineItem =
  | { kind: 'recording'; recording: RecordingData; originalIndex: number; audioSeq: number }
  | { kind: 'addendum'; addendum: AddendumData; addendumIndex: number; noteSeq: number };

const phaseConfig: Record<string, { label: string; icon: any; color: string }> = {
  history: { label: 'History', icon: FileText, color: 'bg-blue-100 text-blue-700 border-blue-300' },
  exam: { label: 'Physical Exam', icon: Mic, color: 'bg-purple-100 text-purple-700 border-purple-300' },
  assessment: { label: 'Assessment', icon: CheckCircle, color: 'bg-green-100 text-green-700 border-green-300' },
  'follow-up': { label: 'Follow-up', icon: RefreshCw, color: 'bg-orange-100 text-orange-700 border-orange-300' },
};

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  confirmed: { icon: CheckCircle, color: 'text-green-600', label: 'Confirmed' },
  updated: { icon: RefreshCw, color: 'text-blue-600', label: 'Updated' },
  contradicted: { icon: AlertCircle, color: 'text-red-600', label: 'Contradicted' },
  new: { icon: Sparkles, color: 'text-purple-600', label: 'New' },
  unchanged: { icon: CheckCircle, color: 'text-gray-400', label: 'Unchanged' },
};

export function RecordingTimeline({
  recordings,
  factReconciliation,
  onResolveConflict,
  addenda = [],
  onEditNote,
  isEditable,
}: RecordingTimelineProps) {
  // Only audio recordings drive the facts timeline; phase=note recordings are synthetic
  const audioRecordings = useMemo(
    () => recordings.map((r, i) => ({ recording: r, originalIndex: i })).filter(({ recording }) => recording.phase !== 'note'),
    [recordings]
  );

  // Build a unified sorted timeline of recordings + addenda
  const timelineItems = useMemo<TimelineItem[]>(() => {
    let audioSeq = 0;
    let noteSeq = 0;
    const items: TimelineItem[] = [
      ...audioRecordings.map(({ recording, originalIndex }) => ({
        kind: 'recording' as const,
        recording,
        originalIndex,
        audioSeq: audioSeq++,
      })),
      ...addenda.map((addendum, addendumIndex) => ({
        kind: 'addendum' as const,
        addendum,
        addendumIndex,
        noteSeq: noteSeq++,
      })),
    ];
    return items.sort((a, b) => {
      const aTime = a.kind === 'recording' ? a.recording.createdAt : a.addendum.createdAt;
      const bTime = b.kind === 'recording' ? b.recording.createdAt : b.addendum.createdAt;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
  }, [audioRecordings, addenda]);

  const unresolvedCount = useMemo(() => {
    if (!factReconciliation) return 0;
    return factReconciliation.reconciledFacts.filter(f => f.status === 'contradicted' && !f.resolution).length;
  }, [factReconciliation]);

  const recordingsWithConflicts = useMemo((): Set<number> => {
    if (!factReconciliation) return new Set<number>();
    const indices = factReconciliation.reconciledFacts
      .filter(f => f.status === 'contradicted' && !f.resolution)
      .flatMap(f => [f.recordingIndex, f.priorRecordingIndex].filter((i): i is number => i !== undefined));
    return new Set(indices);
  }, [factReconciliation]);

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (recordingsWithConflicts.size === 0) return;
    setExpandedItems(prev => {
      const next = new Set(prev);
      recordings.forEach((rec, idx) => {
        if (recordingsWithConflicts.has(idx)) next.add(rec._id);
      });
      return next;
    });
  }, [recordingsWithConflicts, recordings]);

  const toggleItem = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

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

  const formatTime = (isoString: string) =>
    new Date(isoString).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

  const formatDate = (isoString: string) =>
    new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const hasAnything = audioRecordings.length > 0 || addenda.length > 0;

  if (!hasAnything) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mic className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No recordings yet</p>
        </CardContent>
      </Card>
    );
  }

  const headerLabel = [
    audioRecordings.length > 0 && `${audioRecordings.length} recording${audioRecordings.length !== 1 ? 's' : ''}`,
    addenda.length > 0 && `${addenda.length} note${addenda.length !== 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ');

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Recording Timeline</h3>
            <Badge variant="outline" className="ml-auto">{headerLabel}</Badge>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-8">
              {timelineItems.map((item) => {
                if (item.kind === 'addendum') {
                  const { addendum, addendumIndex, noteSeq } = item;
                  const key = `addendum-${addendumIndex}`;
                  const isExpanded = expandedItems.has(key);
                  const firstLine = addendum.text.split('\n')[0];

                  return (
                    <div key={key} className="relative pl-14">
                      <div className="absolute left-0 top-1 h-12 w-12 rounded-full border-4 border-background bg-card flex items-center justify-center z-10">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center bg-amber-100 text-amber-700 border-amber-300">
                          <Pencil className="h-5 w-5" />
                        </div>
                      </div>

                      <Card className="border-2 hover:border-primary/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              className="flex items-center gap-2 flex-1 min-w-0 text-left"
                              onClick={() => toggleItem(key)}
                            >
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              }
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold text-sm">
                                    Doctor Note{noteSeq > 0 ? ` ${noteSeq + 1}` : ''}
                                  </h4>
                                  {addendum.factCount != null && addendum.factCount > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      {addendum.factCount} fact{addendum.factCount !== 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatTime(addendum.createdAt)}</span>
                                  <span>·</span>
                                  <span>{formatDate(addendum.createdAt)}</span>
                                </div>
                                {!isExpanded && (
                                  <p className="text-sm text-muted-foreground mt-1.5 line-clamp-1">{firstLine}</p>
                                )}
                              </div>
                            </button>

                            {isEditable && onEditNote && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditNote(addendumIndex, addendum.text, addendum.createdAt); }}
                                className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Edit note"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{addendum.text}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                }

                // Recording item
                const { recording, originalIndex, audioSeq } = item;
                const phase = phaseConfig[recording.phase || ''] || { label: 'Recording', icon: Mic, color: 'bg-gray-100 text-gray-700 border-gray-300' };
                const PhaseIcon = phase.icon;
                const reconciledFacts = factsByRecording.get(originalIndex) || [];
                const regularFacts = recording.facts || [];
                const isExpanded = expandedItems.has(recording._id);
                const totalFacts = reconciledFacts.length || regularFacts.length;

                const statusCounts = reconciledFacts.reduce((acc, fact) => {
                  acc[fact.status] = (acc[fact.status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);

                return (
                  <div key={recording._id} className="relative pl-14">
                    <div className="absolute left-0 top-1 h-12 w-12 rounded-full border-4 border-background bg-card flex items-center justify-center z-10">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${phase.color}`}>
                        <PhaseIcon className="h-5 w-5" />
                      </div>
                    </div>

                    <Card
                      className="border-2 hover:border-primary/30 transition-colors cursor-pointer"
                      onClick={() => toggleItem(recording._id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-sm">
                                  {`Recording ${audioSeq + 1}${recording.phase ? ` – ${phase.label}` : ''}`}
                                </h4>
                                {recording.duration && (
                                  <Badge variant="secondary" className="text-xs">{formatDuration(recording.duration)}</Badge>
                                )}
                                {totalFacts > 0 && (
                                  <Badge variant="outline" className="text-xs">{totalFacts} fact{totalFacts !== 1 ? 's' : ''}</Badge>
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

                          {!isExpanded && reconciledFacts.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {Object.entries(statusCounts).map(([status, count]) => {
                                const config = statusConfig[status];
                                if (!config || count === 0) return null;
                                const StatusIcon = config.icon;
                                return (
                                  <Tooltip key={status}>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="gap-1 text-xs cursor-help" onClick={(e) => e.stopPropagation()}>
                                        <StatusIcon className={`h-3 w-3 ${config.color}`} />
                                        <span>{count}</span>
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{count} {config.label.toLowerCase()} fact{count !== 1 ? 's' : ''}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t space-y-4">
                            {reconciledFacts.length > 0 ? (
                              <div className="space-y-2">
                                {reconciledFacts.map((fact) => {
                                  const config = statusConfig[fact.status];
                                  const StatusIcon = config.icon;
                                  const displayText = fact.resolution === 'keep-old' && fact.priorText ? fact.priorText : fact.text;
                                  const isUnresolvedConflict = fact.status === 'contradicted' && !fact.resolution;

                                  if (isUnresolvedConflict) {
                                    return (
                                      <div key={fact.factId} className="flex items-start gap-2 text-xs py-0.5">
                                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0 mt-[5px]" />
                                        <div>
                                          <span className="text-foreground">{displayText}</span>
                                          {fact.priorText && (
                                            <span className="text-muted-foreground ml-1.5">
                                              (was: <span className="line-through">{fact.priorText}</span>)
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (fact.status === 'contradicted' && fact.resolution) {
                                    const kept = fact.resolution === 'keep-old' ? fact.priorText : fact.text;
                                    const discarded = fact.resolution === 'keep-old' ? fact.text : fact.priorText;
                                    return (
                                      <div key={fact.factId} className="flex items-start gap-2 text-sm">
                                        <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-muted-foreground">
                                            <span className="font-medium text-foreground">{fact.group}:</span>{' '}{kept}
                                          </p>
                                          <p className="text-[11px] text-muted-foreground/50 line-through mt-0.5">{discarded}</p>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={fact.factId} className="flex items-start gap-2 text-sm group">
                                      <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-muted-foreground">
                                          <span className="font-medium text-foreground">{fact.group}:</span>{' '}{displayText}
                                        </p>
                                        {fact.status === 'updated' && fact.priorText && (
                                          <p className="text-xs text-muted-foreground/60 mt-0.5 line-through">Previously: {fact.priorText}</p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : regularFacts.length > 0 ? (
                              <div className="space-y-2">
                                {regularFacts.map((fact) => (
                                  <div key={fact.id} className="flex items-start gap-2 text-sm">
                                    <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                    <p className="text-muted-foreground">
                                      <span className="font-medium text-foreground">{fact.group}:</span>{' '}{fact.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No facts extracted</p>
                            )}

                            {recording.transcript && (
                              <div className="pt-3 border-t">
                                <h5 className="text-xs font-medium text-muted-foreground mb-2">Transcript</h5>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{recording.transcript}</p>
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
                      <span className="text-muted-foreground">{count} {config.label.toLowerCase()}</span>
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
