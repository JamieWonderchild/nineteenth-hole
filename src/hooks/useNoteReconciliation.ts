'use client';

import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

type Fact = { id: string; text: string; group: string };

/**
 * Provides a `runReconciliation` callback that, given note facts just extracted,
 * fetches existing ambient-scribe recordings for the encounter, calls the
 * reconcile-facts API, and persists the result. Fire-and-forget safe.
 */
export function useNoteReconciliation(encounterId: Id<'encounters'>) {
  const recordings = useQuery(api.recordings.getByConsultation, { encounterId });
  const saveFactReconciliation = useMutation(api.encounters.saveFactReconciliation);

  const runReconciliation = useCallback(
    async (noteFacts: Fact[]) => {
      try {
        // Only use ambient scribe recordings as the existing baseline
        const ambientRecordings = (recordings || []).filter((r) => r.phase !== 'note');
        const existingFacts = ambientRecordings.flatMap((rec, idx) =>
          (rec.facts || []).map((f: Fact) => ({ ...f, recordingIndex: idx }))
        );

        if (existingFacts.length === 0 || noteFacts.length === 0) return;

        const newFactsWithIndex = noteFacts.map((f) => ({
          ...f,
          recordingIndex: ambientRecordings.length,
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
          triggerRecordingCount: ambientRecordings.length + 1,
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
    [recordings, saveFactReconciliation, encounterId]
  );

  return { runReconciliation };
}
