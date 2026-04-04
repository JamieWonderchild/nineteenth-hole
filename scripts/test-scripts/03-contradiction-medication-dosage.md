# Test Script 3: Contradiction — Medication Dosage and Diagnosis Update

**Scenario:** Patient with a chronic condition seen for a follow-up visit. The first recording captures the initial assessment. The second recording corrects the medication details after the provider reviews the pharmacy records, and revises the working diagnosis.

**What to expect:** `contradicted` facts on medication dose and diagnosis, `updated` on one dosage frequency, `confirmed` on demographic and exam facts.

---

## Recording 1 — Initial assessment

*[Start recording]*

"Patient is a 52-year-old male here for follow-up of his thyroid condition. He was diagnosed with hypothyroidism about three years ago.

He reports he has been taking levothyroxine 50 micrograms once daily. Says he takes it in the morning with breakfast. He feels his energy has been reasonable, no major complaints.

He also takes lisinopril 5 milligrams daily for mild hypertension, diagnosed last year. No other medications. No known drug allergies.

Vitals today: blood pressure 132 over 84, heart rate 72 beats per minute, temperature 36.6 degrees Celsius, weight 91 kilograms.

On exam he appears well, no periorbital oedema, no goitre palpable. Reflexes are normal. Skin is normal.

Working assessment: hypothyroidism, stable on current regimen. Will recheck TSH today."

*[Stop recording]*

---

## Recording 2 — Provider correction after pharmacy record review

*[Start recording]*

"Corrections after pulling up pharmacy dispensing records on the portal.

First, levothyroxine dose: the pharmacy shows he is dispensed levothyroxine 75 micrograms, not 50 micrograms. He has been on 75 since his dose was uptitrated fourteen months ago. The 50 microgram dose is outdated. Patient confirmed he does take one tablet daily but didn't know the strength.

Second, important correction on administration: he takes it with breakfast, but levothyroxine should be taken on an empty stomach. This is a compliance issue that likely explains suboptimal TSH control. Will counsel him today.

Third, lisinopril dose correction: pharmacy shows 10 milligrams daily, not 5 milligrams. Dose was doubled six months ago per records from his primary care provider.

TSH result just came back: 8.4 mIU per litre, which is elevated. Given the elevated TSH and corrected medication context, the assessment should be updated to hypothyroidism, suboptimally controlled, likely due to medication non-compliance with administration instructions rather than an inadequate dose.

All other history and exam findings are unchanged."

*[Stop recording]*

---

**Contradictions to resolve:**
- Levothyroxine dose: `50 micrograms` → `75 micrograms`
- Lisinopril dose: `5 milligrams daily` → `10 milligrams daily`
- Assessment: `hypothyroidism, stable` → `hypothyroidism, suboptimally controlled`

**Updated facts:** Levothyroxine administration timing (new compliance concern identified)

**Confirmed facts:** Demographics, blood pressure, heart rate, weight, no drug allergies, physical exam findings

**Expected reconciliation:** `contradicted` on both medication doses and assessment, `confirmed` on vitals and demographics, `new` on TSH result and compliance counselling plan
