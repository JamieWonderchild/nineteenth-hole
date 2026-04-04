# Test Script 1: Contradiction — Allergy History Reversal

**Scenario:** Adult patient presenting with a skin infection. In the first recording the provider notes no known drug allergies. In the second recording the patient corrects this after recalling a prior reaction.

**What to expect:** Reconciliation agent flags allergy status as `contradicted`, blocking medical coding until resolved.

---

## Recording 1 — Initial intake

*[Start recording]*

"Patient is a 38-year-old male presenting today for evaluation of a skin infection on his right forearm. He noticed increasing redness and warmth at the site about four days ago, following a minor scrape from yard work.

Patient reports no known drug allergies. Current medications include lisinopril 10 milligrams daily for hypertension and a daily multivitamin. No other medications.

Vitals: blood pressure 128 over 82, heart rate 78 beats per minute, temperature 38.1 degrees Celsius, respiratory rate 16. Oxygen saturation 99 percent on room air. Weight 84 kilograms.

On exam the patient is alert and in no acute distress. There is a 4 by 3 centimetre area of erythema on the right forearm with central fluctuance, consistent with a cutaneous abscess. Surrounding cellulitis extends approximately 2 centimetres beyond the abscess border. No streaking, no regional lymphadenopathy.

Plan is incision and drainage, wound culture, and empiric antibiotic coverage pending culture results."

*[Stop recording]*

---

## Recording 2 — Patient correction after medication review

*[Start recording]*

"Need to add an important correction. While reviewing the medication history the patient recalled that he had a significant allergic reaction to amoxicillin-clavulanate approximately two years ago. He developed a widespread urticarial rash and throat tightness within an hour of the first dose. He was treated in the emergency department with epinephrine and diphenhydramine. He was never formally allergy-tested but was told to avoid penicillin-class antibiotics going forward.

So the allergy status should be updated: allergic to amoxicillin-clavulanate, reaction type anaphylaxis, with cross-reactivity risk to other penicillins.

All other information from the first recording stands. This rules out beta-lactam antibiotics for empiric coverage — will use trimethoprim-sulfamethoxazole or clindamycin instead pending culture sensitivity."

*[Stop recording]*

---

**Contradictions to resolve:**
- Allergy status: `no known drug allergies` → `allergic to amoxicillin-clavulanate (anaphylaxis)`

**Expected reconciliation:** `contradicted` on allergy, everything else `confirmed` or `unchanged`
