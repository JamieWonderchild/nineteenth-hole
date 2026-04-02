import type { Id } from 'convex/_generated/dataModel';

type Fact = { id: string; text: string; group: string };
type CreateRecordingFn = (args: {
  encounterId: Id<'encounters'>;
  phase: string;
  facts: Fact[];
}) => Promise<unknown>;
type RunReconciliationFn = (noteFacts: Fact[]) => Promise<void>;
type SetFactCountFn = (count: number) => Promise<unknown>;

/**
 * Fire-and-forget: extract clinical facts from a dictated note and save them
 * as a synthetic "note" recording so they appear in the facts panel.
 *
 * Optionally runs fact reconciliation against existing ambient recordings and
 * writes the extracted fact count back to the note entry for display purposes.
 * Does NOT trigger billing extraction (that's already handled by addAddendum).
 * Errors are swallowed — this must never block or surface to the user.
 */
export async function extractAndSaveNoteFacts(
  encounterId: Id<'encounters'>,
  noteText: string,
  createRecording: CreateRecordingFn,
  runReconciliation?: RunReconciliationFn,
  setFactCount?: SetFactCountFn,
): Promise<void> {
  try {
    const res = await fetch('/api/corti/facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: noteText }),
    });
    if (!res.ok) return;
    const { facts } = await res.json();
    if (!Array.isArray(facts) || facts.length === 0) return;
    await createRecording({ encounterId, phase: 'note', facts });
    if (setFactCount) {
      setFactCount(facts.length).catch((err) =>
        console.error('[NoteFactsExtraction] setFactCount failed:', err)
      );
    }
    if (runReconciliation) {
      runReconciliation(facts).catch((err) =>
        console.error('[NoteFactsExtraction] Reconciliation failed:', err)
      );
    }
  } catch {
    // Non-blocking — facts extraction failure must not surface to the user
  }
}
