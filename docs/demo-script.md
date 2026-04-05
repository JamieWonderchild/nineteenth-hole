# Platform Demo Script

**Audience:** Prospective customers, investors
**Format:** Live walkthrough (dark mode recommended)

Two versions below: [Full (~20 min)](#full-demo--20-min) and [Short (~5 min)](#short-demo--5-min).

---

## Setup Checklist

Before the demo, ensure the following are in place:

- [ ] **James Harrison** exists as a patient with at least one prior published encounter so his clinical profile is already built
- [ ] The profile build has completed (check the "Built from N encounters" badge on his profile)
- [ ] Browser is logged in and on the home page
- [ ] Dark mode enabled
- [ ] Tabs pre-positioned: Home → Patient Records → (encounter will open live)
- [ ] Microphone tested and working
- [ ] No other tabs or notifications visible

---

## Demo Patient

**James Harrison** · 58M · Established patient
History of Type 2 diabetes (on metformin) and hypertension.
Presenting today with fatigue and shortness of breath on exertion. Labs from last visit are back.

This case covers:

| Feature | How it appears |
|---|---|
| Ambient consultation | Full doctor–patient dialogue, both voices |
| Note dictation | Provider solo clinical formulation, same encounter |
| Lab result extraction | Values read aloud → auto-extracted |
| ICD-10 coding | T2DM with hyperglycaemia, hypertension, dyspnoea, anaemia, hyperlipidaemia |
| CPT billing | 99214 office visit, moderate complexity |
| Facts panel | Combined facts from ambient + dictation |
| Case reasoning | AI flags anaemia pattern, statin appropriateness |
| Document generation | SOAP note from both recordings |
| Patient companion | Patient asks about new medication |
| Profile update | Second encounter shows longitudinal evolution |

---

## Full Demo (~20 min)

---

### 1. Home Page & Patient List (2 min)

**Show:** Home page dashboard

> *"The day starts here. Pending encounters, overdue follow-ups, recently seen patients — all in one place. Nothing buried."*

**Navigate to:** Patient Records

> *"The patient list isn't just names. Each row pulls from the living clinical profile — active problems, allergy flags, last visit date. You get the clinical picture before you open a chart."*

- Point out condition chips and allergy indicators on a couple of patients
- Point out visit count and last seen date on the right

**Click:** James Harrison

> *"James is coming in this morning. Here's his profile."*

- Point to the clinical narrative summary
- Point to active problems with ICD-10 codes
- Point to current medications

> *"This has been built automatically from every encounter on record. The system has read every note and distilled it into a living briefing. Nothing maintained manually."*

---

### 2. Start the Encounter (1 min)

**Click:** New Encounter → select James Harrison → Ambient Consultation

> *"He's in the room. Ambient mode picks up the whole room — both voices, no microphone handoff, no typing. We just talk."*

**Hit record.**

---

### 3. Ambient Consultation (3 min)

*Read naturally, as if in the consultation room. Approximately 90 seconds of speech.*

---

**Provider:** "James, good to see you. How have you been feeling since your last visit?"

**Patient:** "Not great, honestly. I've been really tired, and I'm getting short of breath walking up the stairs. It wasn't like this a few months ago."

**Provider:** "Any chest pain? Palpitations?"

**Patient:** "No chest pain. Maybe a bit of a racing feeling once or twice."

**Provider:** "Okay. Your labs came back. HbA1c is 8.4% — up from 7.9 at your last visit, so your sugar control has slipped a bit. Fasting glucose was 11.2. LDL cholesterol is 3.8, which is higher than we'd like given your diabetes. Kidney function is stable, creatinine 98. Haemoglobin is 11.8 — mildly low."

**Patient:** "Is that why I'm so tired?"

**Provider:** "Quite possibly, yes. The anaemia combined with not-great sugar control will make you feel that way. Let me examine you."

**Provider:** "Blood pressure today is 152 over 94 — a bit high. Heart sounds normal, chest is clear, no peripheral oedema."

**Provider:** "Here's the plan, James. We're going to increase your metformin to 1 gram twice daily. I'm also going to start you on atorvastatin 40 milligrams at night given that LDL. For the anaemia, I want to check iron studies — we'll draw blood today. I'd like you to have a 24-hour ECG given the palpitations, and I'm referring you to cardiology just to be safe. Come back in six weeks."

**Patient:** "Okay, that all makes sense. Thank you."

---

**Stop recording.**

> *"That's the consultation. Now — the patient has left the room. I'm going to add my own clinical note by dictating, same encounter."*

---

### 4. Dictate a Note (1.5 min)

**Click:** Dictate *(header button on the encounter)*

> *"Same encounter, different mode. This is solo dictation — my structured clinical thinking layered on top of the ambient recording."*

**Hit record.**

---

*Read the following — approximately 25 seconds:*

**Provider:** "Clinical note, James Harrison. Assessment: poorly controlled Type 2 diabetes, HbA1c 8.4, up from 7.9. Mild normocytic anaemia, haemoglobin 11.8 — iron deficiency to be confirmed, CKD-related anaemia to be excluded given creatinine 98. LDL elevated at 3.8, statin indicated given diabetes and cardiovascular risk. Blood pressure suboptimally controlled, 152 over 94. Palpitations — low threshold for investigation. Plan as discussed: metformin uptitrated, atorvastatin 40 milligrams nocte initiated, iron studies ordered, 24-hour Holter ECG requested, cardiology referral placed. Review six weeks."

---

**Stop recording.**

> *"Both recordings are now part of the same encounter. The ambient captured the room — the patient's words, the dialogue, the human side. The dictation captured my structured clinical formulation. Every document and every code is generated from both."*

---

### 5. Facts Panel (2 min)

**Navigate to:** Facts

> *"Every clinical fact from the consultation and the dictation, combined. Symptoms, examination findings, lab values — HbA1c 8.4, fasting glucose 11.2, LDL 3.8, haemoglobin 11.8, creatinine 98, BP 152/94. None of this required any typing."*

- Scroll through the facts list slowly
- Pause on lab values

> *"Look at the lab results section. The values I read aloud in the consultation have been extracted as discrete structured results. The system isn't just transcribing — it's understanding a clinical conversation."*

---

### 6. Case Reasoning (1.5 min)

**Navigate to:** Case Reasoning

> *"For complex cases, this is where it gets genuinely useful."*

- Run case reasoning if not already complete

> *"It's flagging the combination of anaemia and mildly elevated creatinine as worth monitoring — that pattern can indicate CKD-related anaemia, which changes the management approach. It's also confirming the statin is appropriate given his diabetes and LDL. Not replacing clinical judgement — a second pair of eyes across the whole case."*

---

### 7. Document Generation (1 min)

**Navigate to:** Generate documents → SOAP note

> *"Ten seconds. A complete, structured clinical note — built from both the ambient consultation and the dictation. Not a transcript, a proper SOAP note. We can generate a referral letter to cardiology or a patient-facing summary from the same encounter."*

- Show the generated SOAP note, scrolling through it without reading aloud

---

### 8. Publish (30 sec)

**Click:** Publish

> *"Publishing triggers the full downstream pipeline simultaneously — coding, billing, profile update, patient companion. All in the background."*

*Wait for processing.*

---

### 9. ICD-10 Coding (1 min)

**Show:** Medical coding panel

> *"ICD-10 codes suggested from what was said in the room and dictated. E11.65 — Type 2 diabetes with hyperglycaemia. I10 — hypertension. R06.09 — dyspnoea. D64.9 — anaemia. E78.5 — hyperlipidaemia. The coder reviews and confirms — for straightforward cases like this, it's essentially done."*

- Point to each code

---

### 10. Billing & CPT Codes (1 min)

**Show:** Billing panel

> *"CPT codes — 99214, established patient, moderate complexity. Determined automatically from the number of diagnoses, data reviewed, and management complexity."*

- Show the estimated dollar value

> *"Every encounter has a value attached from the moment it's published. Nothing falls off the billing cycle."*

---

### 11. Patient Companion (1.5 min)

**Navigate to:** Patient companion

> *"James gets a link — works on any phone, no app download. He can ask questions about what was discussed today."*

**Show:** *"What is atorvastatin and why am I taking it?"* → companion response

> *"Grounded only in his encounter and history — not a general chatbot. He gets answers at 11pm without calling the practice."*

---

### 12. Updated Profile & Second Encounter (5 min)

**Navigate to:** James Harrison — Patient Records

> *"His profile has already updated. New diagnoses in active problems, atorvastatin in medications, anaemia flagged. No manual update."*

- Point to updated active problems, medications, clinical narrative

> *"Six weeks later, James comes back. Iron studies confirmed deficiency. Cardiology cleared him on the Holter. Quick follow-up — ambient again."*

**New Encounter → James Harrison → Ambient → Record**

---

**Provider:** "James, good news — cardiology reviewed your 24-hour ECG and it's normal. Your iron studies show iron deficiency, ferritin was 8, so we're starting you on ferrous sulphate 200 milligrams daily with food. Blood pressure today is 138 over 86 — much better. Keep doing what you're doing."

**Patient:** "That's a relief. Will the iron help with the tiredness?"

**Provider:** "Yes, you should notice improvement over the next four to six weeks. We'll recheck your bloods at your next visit."

---

**Stop → Publish → Navigate to James Harrison profile**

> *"The profile has updated. Ferritin 8 in lab results. Iron deficiency anaemia confirmed and coded. Ferrous sulphate in current medications. Cardiology clearance in the narrative. Every encounter adds to the picture. The clinician always walks in with context."*

- Point to the "Built from N encounters" counter incrementing

---

### Closing

> *"From the room to the record to the bill — automated, accurate, and in the background. The clinician just had to show up and do their job."*

---

## Short Demo (~5 min)

*Best for investor pitches, trade show conversations, or when time is tight. Shows the full core loop including both ambient and dictation modes. Skip case reasoning and companion.*

---

### Setup

Same patient — James Harrison, profile already built.
Navigate to his patient detail page before starting.

---

### Script

**Show:** James Harrison's patient profile (10 sec)

> *"This is James. Established patient, Type 2 diabetes, hypertension. His clinical profile is built automatically from every encounter on record — problems, medications, history. We didn't type any of this."*

**Click:** New Encounter → Ambient Consultation → Record

> *"He's in the room. Ambient mode — both voices, no typing."*

---

*Read the following — approximately 60 seconds:*

**Provider:** "James, your labs came back. HbA1c is 8.4, up from 7.9 — sugar control has slipped. LDL is 3.8, which is high. Haemoglobin is 11.8, mildly low, which may explain the fatigue you've been having. Blood pressure today is 152 over 94. Here's the plan — we're increasing metformin to 1 gram twice daily, starting atorvastatin 40 milligrams at night for the cholesterol, and I want to check iron studies today. I'm also referring you to cardiology for a 24-hour ECG given the occasional palpitations. Come back in six weeks."

**Patient:** "Okay, understood. Thank you."

---

**Stop recording.**

> *"Patient's left the room. I'll now dictate my clinical note — same encounter."*

**Click:** Dictate → Record

---

*Read the following — approximately 20 seconds:*

**Provider:** "Assessment: poorly controlled Type 2 diabetes, mild anaemia — iron deficiency vs CKD-related. Elevated LDL, statin indicated. Blood pressure suboptimally controlled. Plan: metformin uptitrated, atorvastatin initiated, iron studies, cardiology referral. Review six weeks."

---

**Stop recording.**

> *"Both recordings, one encounter. Now watch what the platform does."*

**Navigate to:** Facts

> *"Lab values I read aloud — HbA1c 8.4, LDL 3.8, haemoglobin 11.8, BP 152/94 — extracted as discrete structured results. The clinical formulation from the dictation is in there too. No typing."*

- Pause on lab results section

**Click:** Publish

*Wait briefly.*

**Show:** ICD coding panel

> *"ICD-10 codes — T2DM with hyperglycaemia, hypertension, anaemia, hyperlipidaemia, dyspnoea. From both recordings."*

**Show:** Billing panel

> *"99214 — moderate complexity office visit. Billed automatically."*

- Show dollar value

**Navigate to:** James Harrison profile

> *"Profile updated. New diagnoses, new medication, anaemia flagged. Every encounter builds the picture forward."*

> *"From the room to the record to the bill — the clinician just had to show up."*

---

### Short Demo Timing

| Section | Duration |
|---|---|
| Patient profile intro | 20 sec |
| Start encounter (ambient) | 10 sec |
| Ambient consultation | 60 sec |
| Start dictation | 10 sec |
| Dictated note | 20 sec |
| Facts panel | 40 sec |
| Publish + ICD coding | 40 sec |
| Billing | 20 sec |
| Profile update | 20 sec |
| **Total** | **~5 min** |

---

## Full Demo Timing Reference

| Section | Duration |
|---|---|
| Home page & patient list | 2 min |
| Start encounter | 1 min |
| Ambient consultation | 3 min |
| Dictate a note | 1.5 min |
| Facts panel | 2 min |
| Case reasoning | 1.5 min |
| Document generation | 1 min |
| Publish | 0.5 min |
| ICD-10 coding | 1 min |
| Billing & CPT | 1 min |
| Patient companion | 1.5 min |
| Updated profile & second encounter | 5 min |
| **Total** | **~21 min** |

---

## Handling Questions

**"How accurate is the coding?"**
The ICD suggestions are reviewed and confirmed by the coder — the system proposes, the coder disposes. It's a starting point, not a black box.

**"Is the data secure / HIPAA compliant?"**
Audio is processed in real-time and not stored beyond what's needed. All data is encrypted at rest and in transit.

**"What if the AI gets something wrong in the facts?"**
Every fact is reviewable and editable before the note is finalised. The system surfaces everything — the clinician has final sign-off.

**"Can it handle specialist consultations, not just primary care?"**
Yes — fact extraction and coding are specialty-aware. Templates are configurable per specialty and encounter type.

**"What does setup look like?"**
Onboarding is self-serve for small practices. Existing patient data can be imported. First encounter can be run on day one.
