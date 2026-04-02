'use client';

import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

type Fact = { id: string; text: string; group: string };

/**
 * Derive the effective "current" fact set from an encounter.
 * If a prior reconciliation exists, use its resolved output (same logic as
 * computeFactsFromDetail on the detail page). Otherwise fall back to raw
 * recording facts deduplicated.
 *
 * This ensures note reconciliation builds on top of the already-resolved
 * ambient-recording baseline rather than re-processing raw facts from all
 * recordings, which causes circular "updated" relationships.
 */
function resolveCurrentFacts(
  recordings: Array<{ facts?: Fact[]; phase?: string }> | null | undefined,
  factReconciliation: { reconciledFacts: Array<{ factId: string; text: string; group: string; status: string; recordingIndex: number; resolution?: string; priorText?: string; priorFactId?: string }> } | null | undefined,
): (Fact & { recordingIndex: number })[] {
  if (factReconciliation) {
    const seen = new Set<string>();
    const result: (Fact & { recordingIndex: number })[] = [];
    for (const rf of factReconciliation.reconciledFacts) {
      // Skip facts superseded by a newer version
      if (rf.status === 'superseded') continue;
      // For keep-old resolutions use the prior text
      const text = rf.resolution === 'keep-old' && rf.priorText ? rf.priorText : rf.text;
      const key = text.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          id: rf.resolution === 'keep-old' && rf.priorFactId ? rf.priorFactId : rf.factId,
          text,
          group: rf.group,
          recordingIndex: rf.recordingIndex,
        });
      }
    }
    return result;
  }

  // No prior reconciliation — flatten ambient recording facts with dedup
  const ambientRecordings = (recordings || []).filter((r) => r.phase !== 'note');
  const seen = new Set<string>();
  const result: (Fact & { recordingIndex: number })[] = [];
  for (let idx = 0; idx < ambientRecordings.length; idx++) {
    for (const f of ambientRecordings[idx].facts || []) {
      const key = f.text.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ ...f, recordingIndex: idx });
      }
    }
  }
  return result;
}

/**
 * Provides a `runReconciliation` callback that, given note facts just
 * extracted, reconciles them against the encounter's current resolved fact
 * set and persists the result. Fire-and-forget safe.
 */
export function useNoteReconciliation(encounterId: Id<'encounters'>) {
  const recordings = useQuery(api.recordings.getByConsultation, { encounterId });
  const encounter = useQuery(api.encounters.getById, { id: encounterId });
  const saveFactReconciliation = useMutation(api.encounters.saveFactReconciliation);

  const runReconciliation = useCallback(
    async (noteFacts: Fact[]) => {
      try {
        const existingFacts = resolveCurrentFacts(
          recordings,
          (encounter as { factReconciliation?: Parameters<typeof resolveCurrentFacts>[1] } | null | undefined)?.factReconciliation,
        );

        if (existingFacts.length === 0 || noteFacts.length === 0) return;

        const maxIndex = existingFacts.reduce((m, f) => Math.max(m, f.recordingIndex), 0);
        const newFactsWithIndex = noteFacts.map((f) => ({
          ...f,
          recordingIndex: maxIndex + 1,
        }));

        const res = await fetch('/api/corti/reconcile-facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ existingFacts, newFacts: newFactsWithIndex }),
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!data.success || !data.reconciliation) return;

        const sanitized = {
          ...data.reconciliation,
          triggerRecordingCount: maxIndex + 2,
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

        await saveFactReconciliation({ encounterId, factReconciliation: sanitized });
      } catch (err) {
        console.error('[NoteReconciliation] Background reconciliation failed:', err);
      }
    },
    [recordings, encounter, saveFactReconciliation, encounterId]
  );

  return { runReconciliation };
}
