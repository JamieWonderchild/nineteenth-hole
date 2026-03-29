# Document Generation

## Overview

Documents are generated from encounter facts using Corti's v2 document generation API. Seven document types are supported, stored in `encounters.generatedDocuments`.

---

## Document Types

| Type | DB Key | Template | Notes |
|------|--------|----------|-------|
| SOAP Note | `soapNote` | `corti-soap` | Default Corti template |
| Client Summary | `clientSummary` | — | Section overrides only |
| Discharge Instructions | `dischargeInstructions` | — | Section overrides only |
| Prescription | `prescription` | — | Section overrides only |
| Follow-Up Plan | `followUpPlan` | — | Section overrides only |
| Lab Request | `labRequest` | — | Section overrides only |
| Referral Letter | `referralLetter` | — | Section overrides only |

There is also an `invoice` key in the schema (generated separately via billing flow).

### `DOC_TYPE_TO_DB_KEY` mapping
```typescript
'soap-note' → 'soapNote'
'client-summary' → 'clientSummary'
'discharge-instructions' → 'dischargeInstructions'
'prescription' → 'prescription'
'follow-up-plan' → 'followUpPlan'
'lab-request' → 'labRequest'
'referral-letter' → 'referralLetter'
```

---

## Generation Pipeline

```
WorkflowPanel selects doc type
  ↓
POST /api/workflow
  → builds context: [{ type: 'facts', data: SimplifiedFact[] }]
  → adds vet notes as user-source facts
  → calls CortiClient.generateDocumentRaw()
  ↓
Corti generates sections
  ↓
Auto-saved to encounters.generatedDocuments (if consultationId prop present)
  ↓
Displayed in WorkflowPanel
```

---

## Context Construction

Context array must be **exactly 1 entry**:
```typescript
context: [{
  type: 'facts',
  data: [
    // Encounter facts from recordings
    { id: '...', text: '...', group: 'history', source: 'corti' },
    // Vet notes added as user facts
    { id: 'vet-diagnosis', text: vetNotes.diagnosis, group: 'assessment', source: 'user' },
    { id: 'vet-treatment', text: vetNotes.treatmentPlan, group: 'plan', source: 'user' },
  ]
}]
```

**Never send raw transcript** as context — it bypasses Corti's section routing system and produces worse output.

---

## Section Override Reference

For runtime customization (Referral Letter, Lab Request):

```typescript
interface SectionOverride {
  nameOverride?: string;
  contentOverride?: string;        // Include:/Exclude: format for fact routing
  writingStyleOverride?: string;   // Dropdown value from Directus
  formatRuleOverride?: string;
  additionalInstructionsOverride?: string;
}
```

**Overrides replace defaults entirely.** If you set `contentOverride`, you must also set any other fields you want to keep.

### `contentOverride` format
```
Include: medications, diagnosis, treatment plan
Exclude: owner contact, billing information
```

The content field controls which facts get routed to which section. Without it, all facts go to all sections (noisy output).

### Writing style
Writing style is a dropdown in Directus — not free text. Style descriptions should go in `additionalInstructionsOverride` or `nameOverride` prompt fields instead.

---

## Fallback Strategy

If a primary template config returns 500:
- `lamina-*` templates fall back to `corti-*` equivalents
- Fallback is logged but transparent to the user

---

## Auto-Save

`WorkflowPanel` accepts a `consultationId` prop. When present, each generated document is automatically saved to Convex after generation via `saveGeneratedDocuments` mutation.

`lastGeneratedAt` on the encounter is updated on each save.

---

## Document Viewer

Documents are displayed in a document viewer component. Code blocks within documents use transparent backgrounds (not black) to stay readable in dark mode.
