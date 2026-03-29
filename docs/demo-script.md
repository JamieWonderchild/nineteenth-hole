# [PRODUCT_NAME] Demo Walkthrough

**Patient:** Nala — Weimaraner, 6yr F/S
**Case:** Limping right front leg

---

## Before You Start

- [ ] Logged in, org active
- [ ] Nala (Weimaraner, 6yr F/S) exists as a patient with at least one prior encounter
- [ ] Billing catalog has items (Physical Exam, Gabapentin, Rimadyl, X-ray, CBC Panel)
- [ ] Mic permissions granted
- [ ] Incognito window ready (for companion)

---

## 1. Create a Encounter

- Go to Nala's patient page
- Click **New Encounter**
- Reason for visit: *"Limping right front leg — 3 days"*
- Click **Create**

---

## 2. First Recording — History

- Click **Begin Encounter** → click the mic

**Dictate:**

> This is Nala, a six year old female spayed Weimaraner. Owner reports she's been limping on her right front leg for the past three days. She was seen two weeks ago and had mild arthritis noted in both hips. Currently on Rimadyl, seventy-five milligrams twice daily. Weight was thirty kilograms at last visit. Owner says appetite and energy are normal, just the limp.

- Point out facts extracting in real time in the right panel
- Click **Stop** → review the extracted facts (species, breed, age, medications, complaint)
- Click **Save**

---

## 3. Second Recording — Physical Exam

- Click **Add Recording** → mic

**Dictate:**

> Physical examination of Nala. Temperature 38.5 degrees Celsius. Heart rate 90 beats per minute. Respiratory rate 20. On palpation there's tenderness over the distal radius of the right foreleg. No swelling or crepitus. Range of motion slightly reduced on flexion. Left foreleg is normal. Hip flexion bilateral — mild discomfort on full extension, consistent with known arthritis. Neurological exam unremarkable. Assessment: soft tissue injury of the right forelimb, likely a strain. Plan: add Gabapentin 100 milligrams twice daily for pain, continue Rimadyl, restrict exercise for two weeks, recheck in fourteen days.

- Click **Stop** → **Save**

---

## 4. Facts & Reconciliation

- Open the **Facts** tab — show facts grouped by recording
- Point out the coloured dots: green = confirmed across recordings, yellow = updated, red = conflict
- Show that weight and medications were confirmed across both recordings

---

## 5. Document Generation

- In the workflow panel, select document types:
  **SOAP Note, Client Summary, Discharge Instructions, Prescription, Follow-Up Plan**
- Add vet notes:
  - Diagnosis: *Right forelimb soft tissue strain; concurrent bilateral hip osteoarthritis*
  - Treatment: *Gabapentin 100mg BID x14 days, continue Rimadyl 75mg BID, exercise restriction 2 weeks, recheck 14 days*
- Click **Generate Documents**
- Click through each document as they appear — show SOAP note, client summary, prescription
- Make a small inline edit to show it's editable

---

## 6. Case Reasoning

- Open **Case Reasoning** / VetChat
- Ask: *"What are the top differentials for a limping Weimaraner with no fracture on radiograph and tenderness over the distal radius?"*
- Show the response
- Ask: *"Any drug interactions between Rimadyl and Gabapentin in dogs?"*
- Show the response

---

## 7. Billing

- Open the **Billing** tab
- Show items extracted automatically from the recordings (Physical Exam, Gabapentin, Rimadyl)
- Add a missing item manually if needed
- Click **Generate Invoice** → show the itemised invoice

---

## 8. Publish & Owner Companion

- Click **Publish** → confirm
- Click **Share with Owner** → copy the link
- Open in incognito — show the companion page
- Ask: *"What medication was prescribed and what's the dose?"*
- Ask: *"Can Nala go for walks this week?"*
- Ask: *"What should I watch for at home?"*

---

## Troubleshooting

**Facts not extracting** — Check mic permissions. Look for `[Corti Facts]` in Console.

**Document generation fails** — Check `CORTI_CLIENT_ID`, `CORTI_CLIENT_SECRET`, `CORTI_TENANT` in `.env`.

**Reconciliation doesn't trigger** — Requires 2+ recordings.

**Billing items missing** — Background extraction runs after save, give it 5–10 seconds.

**Companion page error** — Ensure encounter is Published and companion link is visible.

**Case reasoning times out** — Normal response is 10–12s. Do not re-enable `web-search-expert`.
