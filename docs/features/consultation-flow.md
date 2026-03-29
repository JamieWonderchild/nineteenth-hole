# Encounter Flow

## Lifecycle

```
draft → in-progress → review → published
```

| Status | Meaning |
|--------|---------|
| `draft` | Pre-encounter — patient selected, not yet started |
| `in-progress` | Recording active or paused |
| `review` | Recording complete, vet reviewing facts |
| `published` | Encounter finalized, companion session created |

---

## Full Flow

### 1. Start Encounter
- From patient detail page: "New Encounter" → creates `draft` encounter
- From recording page: new encounter created inline

### 2. Record
- `/encounter/record/[id]` — CortiConsultation component
- Audio streamed to `/api/corti/stream` at 200ms chunk intervals
- Facts appear in real-time via SSE
- Multiple recordings supported per encounter (each saved as a `recordings` record)
- Recording phases: `'history'` | `'exam'` | `'assessment'` | `'follow-up'`

### 3. Review Facts
- Vet reviews extracted facts before saving
- Can add vet notes: diagnosis + treatment plan (`vetNotes` field)
- Facts shown grouped by recording if multiple exist

### 4. Save & Redirect
- POST to save recording facts to Convex
- Facts aggregated to `encounters.facts`
- Vet redirected to `/encounter/[id]` (detail page)

### 5. Detail Page — Command Center
The encounter detail page (`/encounter/[id]`) is the main work surface:

- **WorkflowPanel** — generate and view all 7 document types
- **EvidenceUpload** — upload lab PDFs, imaging, referral letters
- **PriorContext** — reference previous encounters
- **FactReconciliation** — resolve conflicts when 2+ recordings exist
- **Publish** — create owner companion session, mark as published

---

## Multi-Recording

A encounter can have multiple recordings (follow-up, pre-encounter, etc.).

When 2+ recordings exist:
- Fact reconciliation auto-triggers on the detail page
- Facts grouped by recording with colored dot indicators
- Contradictions surfaced for vet resolution
- `aggregatedFacts` respects resolutions (keep-old swaps text)

See [fact-reconciliation.md](fact-reconciliation.md) for details.

---

## Evidence Files

Uploaded via EvidenceUpload component → stored in Convex `_storage` → `evidenceFiles` record created.

- Categories: `'lab-result'` | `'imaging'` | `'referral'` | `'other'`
- Manual notes per file (`notes` field)
- AI extraction deferred (Corti image analysis not confirmed supported)
- Extraction status tracked: `'pending'` | `'processing'` | `'completed'` | `'failed'`

---

## Prior Context

`PriorConsultationSelector` + `PatientHistorySearch` let the vet reference previous encounters.

Selected prior context is passed into the document generation workflow as additional facts, giving Corti historical context for better document quality.

---

## Publishing

Publishing a encounter:
1. Creates a `companionSessions` record with an `accessToken`
2. Sets `encounters.status = 'published'` and `publishedAt`
3. Companion URL: `[PRODUCT_NAME_DOMAIN]/companion/[accessToken]`

See [owner-companion.md](owner-companion.md) for the companion session lifecycle.

---

## Addenda

Post-publish, vets can add addenda (`encounters.addenda` array). Each addendum records the vet ID and timestamp. Used for corrections without modifying the original encounter.
