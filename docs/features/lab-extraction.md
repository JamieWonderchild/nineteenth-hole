# Lab Result Extraction

## Overview

Lab values mentioned verbally during an ambient consultation are automatically extracted as structured, discrete lab results. The clinician reads values aloud; the platform parses them from the transcript without any manual data entry.

---

## How It Works

During ambient recording, the Corti `/stream` endpoint processes the full dialogue in real-time. After recording stops, the facts pipeline runs extraction across the full transcript.

Lab values spoken naturally — *"HbA1c is 8.4, fasting glucose was 11.2, creatinine 98"* — are parsed into structured fact entries with:

- **Test name** — normalised to standard terminology
- **Value** — numeric or text result
- **Unit** — e.g. `%`, `mmol/L`, `µmol/L`, `g/dL`
- **Reference range** — if extractable from context
- **Abnormal flag** — if the provider comments on the value being high/low

---

## Fact Structure

Extracted labs appear in the **Facts** panel under the Lab Results section:

```typescript
{
  group: "lab-results",
  label: "HbA1c",
  value: "8.4",
  unit: "%",
  referenceRange?: "4.0–5.6",
  abnormalFlag?: "high",
}
```

---

## Example Extraction

**Spoken during consultation:**
> *"HbA1c is 8.4% — up from 7.9 at your last visit, so your sugar control has slipped a bit. Fasting glucose was 11.2. LDL cholesterol is 3.8, which is higher than we'd like given your diabetes. Kidney function is stable, creatinine 98. Haemoglobin is 11.8 — mildly low."*

**Extracted facts:**

| Test | Value | Unit | Flag |
|------|-------|------|------|
| HbA1c | 8.4 | % | high |
| Fasting glucose | 11.2 | mmol/L | high |
| LDL cholesterol | 3.8 | mmol/L | high |
| Creatinine | 98 | µmol/L | — |
| Haemoglobin | 11.8 | g/dL | low |

---

## ICD-10 Downstream

Extracted lab values contribute to ICD-10 coding. For example:
- HbA1c 8.4% → `E11.65` (Type 2 DM with hyperglycaemia)
- Haemoglobin 11.8 g/dL (low) → `D64.9` (Anaemia)

---

## Patient Profile Propagation

After publish, lab values are incorporated into the patient's profile via the profile build pipeline. Abnormal values surface in `activeProblems` and `careGaps` where clinically significant.

---

## Limitations

- Extraction accuracy depends on clear verbal enunciation of values and units
- Highly abbreviated or non-standard values may not extract correctly
- All extracted facts are reviewable and editable before the note is finalised
