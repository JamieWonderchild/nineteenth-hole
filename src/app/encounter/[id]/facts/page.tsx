'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  ClipboardList,
  Check,
  Edit2,
  X,
  Save,
} from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { toast } from '@/hooks/use-toast';

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
};

function getGroupLabel(group: string): string {
  return GROUP_LABELS[group] || group.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
  };
  return colors[group] || { border: 'border-l-muted-foreground', text: 'text-muted-foreground' };
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  confirmed: { color: 'text-green-600', bg: 'bg-green-500', label: 'Confirmed' },
  updated: { color: 'text-blue-600', bg: 'bg-blue-500', label: 'Updated' },
  contradicted: { color: 'text-red-600', bg: 'bg-red-500', label: 'Contradicted' },
  new: { color: 'text-purple-600', bg: 'bg-purple-500', label: 'New' },
  unchanged: { color: 'text-muted-foreground', bg: 'bg-gray-400', label: 'Unchanged' },
};

export default function FactsPage() {
  const params = useParams();
  const encounterId = params.id as string;

  const encounter = useQuery(
    api.encounters.getById,
    { id: encounterId as Id<'encounters'> }
  );

  const patient = useQuery(
    api.patients.getPatientById,
    encounter?.patientId
      ? { id: encounter.patientId as Id<'patients'> }
      : 'skip'
  );

  const detail = useQuery(
    api.encounters.getConsultationDetail,
    { encounterId: encounterId as Id<'encounters'> }
  );

  const resolveConflict = useMutation(api.encounters.resolveFactConflict);
  const saveFactReconciliation = useMutation(api.encounters.saveFactReconciliation);
  const updateFactText = useMutation(api.recordings.updateFactText);

  // Fact reconciliation state
  const [isReconciling, setIsReconciling] = useState(false);
  const reconcilingRef = useRef(false);

  // Fact editing state
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [changedFacts, setChangedFacts] = useState<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get data needed for effects
  const reconciliation = detail?.factReconciliation ?? null;
  const recordings = detail?.recordings || [];
  const hasMultipleRecordings = recordings.length > 1;

  // Dedup facts
  const facts = detail?.facts || [];
  const dedupedFacts = useMemo(() => {
    const seen = new Set<string>();
    return facts.filter((f) => {
      const key = `${f.group}::${f.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [facts]);

  type ReconciledFact = NonNullable<typeof reconciliation>['reconciledFacts'][number];
  const reconciliationMap = useMemo(() => {
    if (!reconciliation) return new Map<string, ReconciledFact>();
    const map = new Map<string, ReconciledFact>();
    for (const rf of reconciliation.reconciledFacts) {
      map.set(rf.factId, rf);
      map.set(`text::${rf.text.toLowerCase().trim()}`, rf);
      if (rf.priorText) {
        map.set(`text::${rf.priorText.toLowerCase().trim()}`, rf);
      }
    }
    return map;
  }, [reconciliation]);

  const getReconciliationEntry = useCallback((f: { id: string; text: string }) => {
    return reconciliationMap.get(f.id) || reconciliationMap.get(`text::${f.text.toLowerCase().trim()}`);
  }, [reconciliationMap]);

  // Auto-trigger fact reconciliation when 2+ recordings exist
  useEffect(() => {
    if (!detail?.recordings || detail.recordings.length < 2) return;
    if (reconcilingRef.current) return;

    const existingReconciliation = detail.factReconciliation;
    const recordingCount = detail.recordings.length;

    if (existingReconciliation && existingReconciliation.triggerRecordingCount >= recordingCount) {
      return;
    }

    const runReconciliation = async () => {
      reconcilingRef.current = true;
      setIsReconciling(true);

      try {
        const existingRecordings = detail.recordings.slice(0, -1);
        const lastRecording = detail.recordings[detail.recordings.length - 1];

        const existingFacts = existingRecordings.flatMap((rec, idx) =>
          (rec.facts || []).map(f => ({ ...f, recordingIndex: idx }))
        );
        const newFacts = (lastRecording.facts || []).map(f => ({
          ...f,
          recordingIndex: detail.recordings.length - 1,
        }));

        if (existingFacts.length === 0 || newFacts.length === 0) {
          return;
        }

        const res = await fetch('/api/corti/reconcile-facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ existingFacts, newFacts }),
        });

        if (!res.ok) {
          console.error('[Reconciliation] API error:', res.status);
          return;
        }

        const data = await res.json();
        if (data.success && data.reconciliation) {
          const sanitized = {
            ...data.reconciliation,
            triggerRecordingCount: recordingCount,
            reconciledFacts: data.reconciliation.reconciledFacts.map(
              (rf: Record<string, unknown>) => ({
                ...rf,
                priorFactId: rf.priorFactId ?? undefined,
                priorText: rf.priorText ?? undefined,
                priorRecordingIndex: rf.priorRecordingIndex ?? undefined,
                resolution: rf.resolution ?? undefined,
                resolvedAt: rf.resolvedAt ?? undefined,
              })
            ),
          };
          await saveFactReconciliation({
            encounterId: encounterId as Id<'encounters'>,
            factReconciliation: sanitized,
          });
        }
      } catch (error) {
        console.error('[Reconciliation] Error:', error);
      } finally {
        setIsReconciling(false);
        reconcilingRef.current = false;
      }
    };

    runReconciliation();
  }, [detail?.recordings, detail?.factReconciliation, encounterId, saveFactReconciliation]);

  // Debounced reconciliation for manually edited facts
  useEffect(() => {
    if (changedFacts.size === 0) return;

    // Set 4-second debounce timer
    debounceTimerRef.current = setTimeout(async () => {
      setIsReconciling(true);

      try {
        // Get all current facts
        const allFacts = dedupedFacts.map((f, idx) => ({
          id: f.id,
          text: f.text,
          group: f.group,
          recordingIndex: idx,
        }));

        // Separate changed facts from unchanged
        const changedFactsList = allFacts.filter((f) => changedFacts.has(f.id));
        const unchangedFacts = allFacts.filter((f) => !changedFacts.has(f.id));

        if (changedFactsList.length === 0) {
          setChangedFacts(new Set());
          return;
        }

        // Run reconciliation: compare changed facts against unchanged facts
        const res = await fetch('/api/corti/reconcile-facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            existingFacts: unchangedFacts,
            newFacts: changedFactsList,
          }),
        });

        if (!res.ok) {
          console.error('[Reconciliation] API error:', res.status);
          return;
        }

        const data = await res.json();
        if (data.success && data.reconciliation) {
          const recordingCount = recordings.length;
          const sanitized = {
            ...data.reconciliation,
            triggerRecordingCount: recordingCount,
            reconciledFacts: data.reconciliation.reconciledFacts.map(
              (rf: Record<string, unknown>) => ({
                ...rf,
                priorFactId: rf.priorFactId ?? undefined,
                priorText: rf.priorText ?? undefined,
                priorRecordingIndex: rf.priorRecordingIndex ?? undefined,
                resolution: rf.resolution ?? undefined,
                resolvedAt: rf.resolvedAt ?? undefined,
              })
            ),
          };
          await saveFactReconciliation({
            encounterId: encounterId as Id<'encounters'>,
            factReconciliation: sanitized,
          });
        }

        // Clear changed facts
        setChangedFacts(new Set());
      } catch (error) {
        console.error('[Reconciliation] Error:', error);
      } finally {
        setIsReconciling(false);
      }
    }, 4000); // 4-second debounce

    // Cleanup timer on unmount or when changedFacts changes
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [changedFacts, dedupedFacts, recordings.length, encounterId, saveFactReconciliation]);

  const factGroups = useMemo(() => {
    return dedupedFacts.reduce<Record<string, Array<{ id: string; text: string; group: string }>>>((acc, f) => {
      (acc[f.group] = acc[f.group] || []).push(f);
      return acc;
    }, {});
  }, [dedupedFacts]);

  const handleResolve = async (factId: string, resolution: 'accept-new' | 'keep-old') => {
    try {
      await resolveConflict({ encounterId: encounterId as Id<'encounters'>, factId, resolution });
      toast({ title: resolution === 'accept-new' ? 'Accepted new finding' : 'Kept previous finding' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resolve',
        variant: 'destructive',
      });
    }
  };

  const startEditing = (fact: { id: string; text: string }) => {
    setEditingFactId(fact.id);
    setEditedText(fact.text);
  };

  const cancelEditing = () => {
    setEditingFactId(null);
    setEditedText('');
  };

  const saveEdit = async (fact: { id: string; text: string; group: string }) => {
    const trimmed = editedText.trim();
    if (!trimmed || trimmed === fact.text) {
      cancelEditing();
      return;
    }

    setIsSavingEdit(true);
    try {
      // Update fact text in database
      await updateFactText({
        encounterId: encounterId as Id<'encounters'>,
        factId: fact.id,
        newText: trimmed,
      });

      // Mark fact as changed (triggers debounced reconciliation)
      setChangedFacts((prev) => new Set(prev).add(fact.id));

      // Reset debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      cancelEditing();
      toast({ title: 'Fact updated' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const renderFactItem = (f: { id: string; text: string; group: string }, recordingIndex: number = 0) => {
    const entry = getReconciliationEntry(f);
    const isEditing = editingFactId === f.id;

    // Edit mode UI
    if (isEditing) {
      return (
        <li key={f.id} className="text-sm">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(f);
                if (e.key === 'Escape') cancelEditing();
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => saveEdit(f)}
              disabled={isSavingEdit}
            >
              {isSavingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={cancelEditing}
              disabled={isSavingEdit}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </li>
      );
    }

    if (!entry) {
      return (
        <li key={f.id} className="text-sm text-foreground group flex items-center justify-between">
          <span>{f.text}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => startEditing(f)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        </li>
      );
    }

    const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.new;
    const isUnchanged = entry.status === 'unchanged';
    const needsResolution = (entry.status === 'contradicted' || entry.status === 'updated') && !entry.resolution;
    const isResolved = !!entry.resolution;

    const isOldVersion = entry.priorText
      ? f.text.toLowerCase().trim() === entry.priorText.toLowerCase().trim()
      : false;
    const isSuperseded = isResolved && (
      (isOldVersion && entry.resolution === 'accept-new') ||
      (!isOldVersion && entry.resolution === 'keep-old')
    );

    if (!needsResolution && !isResolved && !entry.priorText) {
      return (
        <li
          key={f.id}
          className={`text-sm text-foreground group flex items-center justify-between gap-1.5 ${isUnchanged ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusCfg.bg} flex-shrink-0`} />
            {f.text}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => startEditing(f)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        </li>
      );
    }

    const content = (
      <li key={f.id} className="text-sm group">
        <div className={`flex items-center justify-between gap-1.5 ${isSuperseded ? 'opacity-50 line-through' : ''}`}>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusCfg.bg} flex-shrink-0`} />
            <span className="text-foreground">{f.text}</span>
            {isResolved && !isSuperseded && (
              <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => startEditing(f)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        </div>
        {entry.priorText && !isOldVersion && (
          <p className={`text-[10px] ml-[15px] ${isResolved && entry.resolution === 'accept-new' ? 'line-through opacity-50' : 'text-muted-foreground'}`}>
            was: {entry.priorText}
          </p>
        )}
        {needsResolution && !isOldVersion && (
          <div className="flex items-center gap-1 ml-[15px] mt-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => handleResolve(entry.factId, 'accept-new')}
            >
              Accept New
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => handleResolve(entry.factId, 'keep-old')}
            >
              Keep Old
            </Button>
          </div>
        )}
      </li>
    );

    return (
      <TooltipProvider key={f.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-xs bg-popover text-popover-foreground border shadow-md px-3 py-2"
          >
            <p className={`text-xs font-semibold ${statusCfg.color}`}>
              {statusCfg.label}
            </p>
            {entry.priorText && (
              <p className="text-xs text-muted-foreground mt-1">
                Previous: {entry.priorText}
                {entry.priorRecordingIndex != null && ` (Recording ${entry.priorRecordingIndex + 1})`}
              </p>
            )}
            {isResolved && (
              <p className="text-xs text-foreground mt-1">
                {entry.resolution === 'accept-new' ? 'Accepted new value' : 'Kept previous value'}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (encounter === undefined || detail === undefined) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (encounter === null || detail === null) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto p-6 text-center space-y-4">
          <p className="text-muted-foreground">Encounter not found</p>
          <AppLink href="/encounter" className="text-sm text-primary hover:underline">
            Back to Encounters
          </AppLink>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <BillingGuard feature="Encounters">
        <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-5">
          {/* Header */}
          <div className="space-y-1">
            <AppLink
              href={`/encounter/${encounterId}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to encounter
            </AppLink>
            <h1 className="text-xl font-semibold">
              {patient?.name || 'Patient'} — Facts
            </h1>
          </div>

          {dedupedFacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 rounded-lg border bg-card">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <ClipboardList className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-medium">No facts captured yet</p>
                <p className="text-sm text-muted-foreground">
                  Facts are extracted automatically from encounter recordings.
                </p>
              </div>
            </div>
          ) : !hasMultipleRecordings ? (
            /* Single recording — flat grouped view */
            <div className="rounded-lg border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {dedupedFacts.length} fact{dedupedFacts.length !== 1 ? 's' : ''} captured
              </h3>
              <div className="space-y-3">
                {(Object.entries(factGroups) as [string, Array<{ id: string; text: string; group: string }>][]).map(([group, groupFacts]) => {
                  const colors = getGroupColors(group);
                  return (
                    <div key={group} className={`border-l-[3px] ${colors.border} pl-3 py-1 space-y-1`}>
                      <h5 className={`text-xs font-semibold ${colors.text}`}>
                        {getGroupLabel(group)}
                      </h5>
                      <ul className="space-y-0.5">
                        {groupFacts.map((f) => renderFactItem(f, 0))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Multiple recordings — per-recording sections with reconciliation */
            <div className="rounded-lg border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {dedupedFacts.length} fact{dedupedFacts.length !== 1 ? 's' : ''} across {recordings.length} recordings
              </h3>

              {/* Reconciliation summary */}
              {reconciliation && (
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <span className="text-muted-foreground font-medium">Reconciliation:</span>
                  {reconciliation.summary.confirmed > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      {reconciliation.summary.confirmed} confirmed
                    </span>
                  )}
                  {reconciliation.summary.updated > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      {reconciliation.summary.updated} updated
                    </span>
                  )}
                  {reconciliation.summary.contradicted > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      {reconciliation.summary.contradicted} contradicted
                    </span>
                  )}
                  {reconciliation.summary.new > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-purple-500" />
                      {reconciliation.summary.new} new
                    </span>
                  )}
                  {reconciliation.summary.unchanged > 0 && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                      {reconciliation.summary.unchanged} unchanged
                    </span>
                  )}
                </div>
              )}

              {isReconciling && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing fact relationships across recordings...
                </div>
              )}

              {/* Per-recording sections */}
              {recordings.map((rec, idx) => {
                const recFacts = (rec.facts || []) as Array<{ id: string; text: string; group: string }>;
                if (recFacts.length === 0) return null;

                const recGroups = recFacts.reduce<Record<string, Array<{ id: string; text: string; group: string }>>>((acc, f) => {
                  (acc[f.group] = acc[f.group] || []).push(f);
                  return acc;
                }, {});

                return (
                  <div key={rec._id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-medium">Recording {idx + 1}</span>
                      {rec.phase && (
                        <Badge variant="outline" className="text-[10px] capitalize h-4 px-1.5">
                          {rec.phase}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {recFacts.length} fact{recFacts.length !== 1 ? 's' : ''}
                      </span>
                      {idx < recordings.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="pl-7 space-y-2">
                      {(Object.entries(recGroups) as [string, Array<{ id: string; text: string; group: string }>][]).map(([group, groupFacts]) => {
                        const colors = getGroupColors(group);
                        return (
                          <div key={group} className={`border-l-[3px] ${colors.border} pl-3 py-1 space-y-1`}>
                            <h6 className={`text-[10px] font-semibold ${colors.text}`}>
                              {getGroupLabel(group)}
                            </h6>
                            <ul className="space-y-0.5">
                              {groupFacts.map((f) => renderFactItem(f, idx))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </BillingGuard>
    </Layout>
  );
}
