# [PRODUCT_NAME] Demo Walkthrough

**Patient:** Sarah Chen — 42F, office manager
**Case:** Low back pain, 2 weeks

---

## Before You Start

- [ ] Logged in, org active
- [ ] Sarah Chen (42F) exists as a patient with at least one prior encounter
- [ ] Billing catalog has items (Physical Exam, MRI Lumbar Spine, Naproxen, Physical Therapy Referral, CBC Panel)
- [ ] Mic permissions granted
- [ ] Incognito window ready (for companion)

---

## 1. Create an Encounter

- Go to Sarah's patient page
- Click **New Encounter**
- Reason for visit: *"Low back pain — 2 weeks"*
- Click **Create**

---

## 2. First Recording — History

- Click **Begin Encounter** → click the mic

**Dictate:**

> This is Sarah Chen, a 42-year-old female office manager presenting with low back pain for the past two weeks. Pain started gradually with no acute injury. She rates it 6 out of 10, worse with prolonged sitting and better with movement. No radiation down the legs, no numbness or tingling. She denies bowel or bladder changes. She's been taking over-the-counter ibuprofen 400 milligrams as needed with partial relief. Past medical history includes mild hypertension, managed with lisinopril 10 milligrams daily. No known drug allergies.

- Point out facts extracting in real time in the right panel
- Click **Stop** → review extracted facts (demographics, complaint, medications, allergies)
- Click **Save**

---

## 3. Second Recording — Physical Exam

- Click **Add Recording** → mic

**Dictate:**

> Physical examination of Sarah. Blood pressure 132 over 84. Heart rate 72 beats per minute. Temperature 36.6 degrees Celsius. Respiratory rate 14. Weight 68 kilograms. On musculoskeletal exam, lumbar range of motion is reduced — flexion to 60 degrees with pain, extension to 15 degrees. Paraspinal muscle tenderness at L4-L5 bilaterally. Straight leg raise is negative bilaterally. Neurological exam of the lower extremities is intact — sensation, strength, and reflexes normal. No midline spinal tenderness. Assessment: mechanical low back pain, likely lumbar muscle strain. Plan: prescribe naproxen 500 milligrams twice daily with food, refer for 6 sessions of physical therapy, and order MRI lumbar spine to rule out disc herniation given duration of symptoms. Return in 4 weeks or sooner if symptoms worsen.

- Click **Stop** → **Save**

---

## 4. Facts & Reconciliation

- Open the **Facts** tab — show facts grouped by recording
- Point out the coloured dots: green = confirmed across recordings, yellow = updated, red = conflict
- Show that blood pressure, weight, and medications were confirmed across both recordings

---

## 5. Document Generation

- In the workflow panel, select document types:
  **SOAP Note, After-Visit Summary, Referral Letter, Prescription, Follow-Up Plan**
- Add provider notes:
  - Diagnosis: *Mechanical low back pain, lumbar muscle strain at L4-L5*
  - Treatment: *Naproxen 500mg BID x14 days, physical therapy 6 sessions, MRI lumbar spine ordered, return in 4 weeks*
- Click **Generate Documents**
- Click through each document as they appear — show SOAP note, after-visit summary, referral letter
- Make a small inline edit to show it's editable

---

## 6. Case Reasoning

- Open **Case Reasoning**
- Ask: *"What are the top differentials for low back pain in a 42-year-old with no leg radiation and negative straight leg raise?"*
- Show the response
- Ask: *"Any interactions between naproxen and lisinopril I should be aware of?"*
- Show the response

---

## 7. Billing

- Open the **Billing** tab
- Show items extracted automatically from the recordings (Physical Exam, Naproxen, MRI Lumbar Spine, Physical Therapy Referral)
- Add a missing item manually if needed
- Click **Generate Invoice** → show the itemised invoice

---

## 8. Publish & Patient Companion

- Click **Publish** → confirm
- Click **Share with Patient** → copy the link
- Open in incognito — show the companion page
- Ask: *"What medication was prescribed and what's the dose?"*
- Ask: *"Can I go for walks this week?"*
- Ask: *"What symptoms should make me come back sooner?"*

---

## Troubleshooting

**Facts not extracting** — Check mic permissions. Look for `[Corti Facts]` in Console.

**Document generation fails** — Check `CORTI_CLIENT_ID`, `CORTI_CLIENT_SECRET`, `CORTI_TENANT` in `.env`.

**Reconciliation doesn't trigger** — Requires 2+ recordings.

**Billing items missing** — Background extraction runs after save, give it 5–10 seconds.

**Companion page error** — Ensure encounter is Published and companion link is visible.

**Case reasoning times out** — Normal response is 10–12s. Do not re-enable `web-search-expert`.
