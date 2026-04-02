import type { Id } from 'convex/_generated/dataModel';

type Fact = { id: string; text: string; group: string };
type CreateRecordingFn = (args: {
  encounterId: Id<'encounters'>;
  phase: string;
  facts: Fact[];
}) => Promise<unknown>;

/**
 * Fire-and-forget: extract clinical facts from a dictated note and save them
 * as a synthetic "note" recording so they appear in the facts panel.
 *
 * Does NOT trigger billing extraction (that's already handled by addAddendum).
 * Errors are swallowed — this must never block or surface to the user.
 */
export async function extractAndSaveNoteFacts(
  encounterId: Id<'encounters'>,
  noteText: string,
  createRecording: CreateRecordingFn,
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
  } catch {
    // Non-blocking — facts extraction failure must not surface to the user
  }
}
