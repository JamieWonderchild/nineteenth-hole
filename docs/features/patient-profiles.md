# Patient Profiles

## Overview

Each patient has a living clinical profile that is built automatically from their encounter history. The profile is rebuilt after every published encounter — no manual maintenance required.

---

## What the Profile Contains

```typescript
patientProfiles: {
  patientId,
  orgId,
  clinicalNarrative: string,          // 2–4 sentence plain-English summary
  activeProblems: [{
    condition: string,
    icd10Code?: string,
    status: 'active' | 'resolved' | 'monitoring',
    onsetDate?: string,
  }],
  currentMedications: [{
    name: string,
    dose?: string,
    frequency?: string,
    startDate?: string,
  }],
  allergies: [{
    allergen: string,
    reaction?: string,
    severity?: string,
  }],
  careGaps: [{
    description: string,
    priority: 'high' | 'medium' | 'low',
  }],
  lastEncounterDate?: string,
  encounterCount: number,
  buildStatus: 'building' | 'complete' | 'failed',
  builtAt: string,
}
```

---

## Build Pipeline

```
Encounter published
  ↓
Fire-and-forget: buildPatientProfile action
  ↓
Corti agent reads all prior encounter facts + new encounter facts
  ↓
Produces structured profile JSON
  ↓
Upserts patientProfiles record
  ↓
UI badge updates: "Built from N encounters"
```

Build is asynchronous — the profile badge updates in real-time via Convex reactive queries.

### Catch-Up Build

On first load of the Patient Records page, a catch-up action runs (6-hour cooldown per org) to rebuild any profiles that are missing or stale. This ensures legacy patients without profiles get caught up automatically.

---

## Patient List Display

On the patient list, profiles power:

- **Condition chips** — active problems (non-resolved, non-Z-code, max 3), cleaned of embedded ICD codes, truncated to 22 chars
- **Allergy indicator** — count of real allergies (NKA/NKDA/nil sentinels filtered out)
- **Last visit date** — from `lastEncounterDate`
- **Visit count** — from `encounterCount`

**Z-code filtering:** Administrative/contextual ICD-10 codes (Z-prefix) are filtered from the condition chips — they are not clinical problems.

**NKA filtering:** "No Known Allergies", "NKDA", "None", "Nil" are filtered before counting allergies. Pattern: `/^(no\s+known|nkda?|none|nil)$/i`

---

## Patient Detail Page

The profile section on the patient detail page shows:

- **Clinical narrative** — the AI-generated summary paragraph
- **Active problems** — with ICD-10 codes
- **Current medications** — with doses and frequencies
- **Allergies** — with reactions
- **Care gaps** — outstanding preventive/monitoring items
- **"Built from N encounters"** badge — shows encounter count; badge appears once profile is complete

---

## Enriched Patient Query

The `getPatientsByOrgEnriched` Convex query fetches all org patients and all org profiles in two indexed queries, joins them in-memory, and returns patients with embedded profile summaries. This is used by the patient list for efficient rendering without N+1 queries.
