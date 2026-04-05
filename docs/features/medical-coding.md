# Medical Coding (ICD-10 & CPT)

## Overview

After an encounter is published, the platform automatically extracts ICD-10 diagnosis codes and CPT procedure/billing codes from the clinical encounter data using the Corti coding pipeline.

---

## Pipeline

```
Encounter published
  ↓
POST /api/corti/coding  (background, fire-and-forget)
  ↓
Corti extracts ICD-10 codes from facts + transcript
  ↓
Corti extracts CPT codes from facts + transcript
  ↓
Results stored in encounters.medicalCoding
  ↓
UI shows codes in the Medical Coding panel
```

Coding status tracked in `encounters.codingStatus`: `'pending'` | `'processing'` | `'completed'` | `'failed'`.

---

## ICD-10 Codes

Extracted from the clinical facts and transcript. Each code includes:

```typescript
{
  code: string,        // e.g. "E11.65"
  description: string, // e.g. "Type 2 diabetes mellitus with hyperglycemia"
  confidence: number,  // 0–1
}
```

Typical codes for a primary care encounter:
- `E11.65` — Type 2 DM with hyperglycaemia
- `I10` — Essential hypertension
- `D64.9` — Anaemia, unspecified
- `E78.5` — Hyperlipidaemia, unspecified
- `R06.09` — Dyspnoea

---

## CPT Codes

Extracted from the encounter type and complexity indicators. Each code includes:

```typescript
{
  code: string,          // e.g. "99214"
  description: string,   // e.g. "Office visit, established patient, moderate complexity"
  units: number,
  confidence: number,
}
```

E&M level (99202–99215) is determined from:
- Number of diagnoses addressed
- Amount of data reviewed (labs, imaging, notes)
- Management decision complexity

**Note:** CPT codes may not be returned for all encounter types — this is Corti API behavior, not a platform bug. If CPT is absent, ICD-10 codes are typically still present.

---

## Coder Review Flow

Codes are surfaced in the encounter's **Medical Coding** panel. The coder:

1. Reviews suggested ICD-10 and CPT codes
2. Adds, removes, or modifies codes as needed
3. Confirms — encounter moves to billing-ready state

The system proposes; the coder confirms. No black-box auto-submission.

---

## Data Storage

Codes are stored in `encounters.medicalCoding`:

```typescript
medicalCoding: {
  icd10Codes: Array<{ code, description, confidence }>,
  cptCodes: Array<{ code, description, units, confidence }>,
  codingStatus: 'pending' | 'processing' | 'completed' | 'failed',
  codedAt?: string,
}
```

---

## Integration with Billing

CPT codes flow directly into the billing panel. The estimated visit value (dollar amount) is calculated from confirmed CPT codes at typical Medicare rates and shown to the provider immediately after coding completes.

See [billing.md](billing.md) for the two-phase billing model.
