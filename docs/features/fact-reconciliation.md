# Fact Reconciliation

## Overview

When a encounter has 2+ recordings, facts may conflict (a temperature recorded in recording 1 might differ in recording 2). Fact reconciliation surfaces these conflicts and lets the vet resolve them.

---

## Data Model

`encounters.factReconciliation`:

```typescript
{
  reconciledFacts: [{
    factId: string,
    text: string,
    group: string,
    status: 'confirmed' | 'updated' | 'contradicted' | 'new' | 'unchanged',
    recordingIndex: number,
    priorFactId?: string,
    priorText?: string,
    priorRecordingIndex?: number,
    resolution?: 'accept-new' | 'keep-old',
    resolvedAt?: string,
  }],
  summary: {
    confirmed: number,
    updated: number,
    contradicted: number,
    new: number,
    unchanged: number,
  },
  reconciledAt: string,
  triggerRecordingCount: number, // number of recordings when last reconciled
}
```

---

## Auto-Trigger

Reconciliation auto-triggers on the encounter detail page when:
- The encounter has 2+ recordings
- `triggerRecordingCount` doesn't match the current recording count (staleness check)

This means adding a new recording to an already-reconciled encounter will re-trigger reconciliation.

---

## Corti Agent

Agent name: `vet-fact-reconciler`

Compares facts across recordings and classifies each as:
- `confirmed` — same fact appears in both recordings
- `updated` — fact updated with new value (e.g., weight changed)
- `contradicted` — directly conflicting values (e.g., temp 38.5°C vs 40.1°C)
- `new` — fact only in later recording
- `unchanged` — not affected by newer recording

API route: `POST /api/corti/reconcile-facts`

---

## UI

ConsultationDetail shows reconciled facts grouped by recording with colored dot indicators:
- Green: confirmed / unchanged
- Yellow: updated / new
- Red: contradicted

**Contradictions** show a resolve button. Vet chooses:
- **Accept new** — use the value from the later recording
- **Keep old** — keep the original value

`aggregatedFacts` (used for document generation) respects resolutions:
- `accept-new` uses the newer text
- `keep-old` swaps back to `priorText`

---

## Mutations

| Mutation | Purpose |
|----------|---------|
| `saveFactReconciliation` | Save reconciliation result |
| `resolveFactConflict` | Vet resolves a specific contradiction |
