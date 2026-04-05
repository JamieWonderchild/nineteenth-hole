// User-facing documentation content for /docs
// Written from the provider's perspective — practical, no technical jargon.

export interface DocArticle {
  slug: string;
  title: string;
  description: string;
  category: DocCategory;
  content: string;
  readTime: number; // minutes
}

export type DocCategory =
  | 'getting-started'
  | 'encounters'
  | 'patients'
  | 'ai-features'
  | 'billing'
  | 'settings';

export const CATEGORY_LABELS: Record<DocCategory, string> = {
  'getting-started': 'Getting Started',
  'encounters': 'Encounters',
  'patients': 'Patients',
  'ai-features': 'AI Features',
  'billing': 'Billing & Coding',
  'settings': 'Settings & Team',
};

export const CATEGORY_ORDER: DocCategory[] = [
  'getting-started',
  'encounters',
  'patients',
  'ai-features',
  'billing',
  'settings',
];

export const DOCS: DocArticle[] = [
  // ─── Getting Started ──────────────────────────────────────────────────────

  {
    slug: 'overview',
    title: 'Welcome',
    description: 'An overview of what the platform does and how it fits into your clinical workflow.',
    category: 'getting-started',
    readTime: 3,
    content: `# Welcome

This platform is a clinical documentation assistant for healthcare providers. It records encounters by voice, automatically extracts clinical facts and lab results, generates professional documents, suggests ICD-10 and CPT codes, and keeps a living clinical profile on every patient — all without manual data entry.

---

## How it works

The core idea is simple: **you talk, the platform listens**.

During a consultation, you record the encounter by voice. The platform transcribes your speech and automatically extracts structured clinical facts — presenting complaints, examination findings, lab values, medications, assessments, and plans. From those facts, it can generate any document you need in seconds.

### The encounter flow

\`\`\`
Record → Review Facts → Publish → Coding + Billing + Profile Update
\`\`\`

1. **Record** — speak naturally during the consultation (ambient mode) or dictate solo (dictation mode)
2. **Review facts** — check the extracted clinical data, including any lab values mentioned aloud
3. **Publish** — triggers ICD-10 coding, CPT billing, patient profile update, and patient companion creation simultaneously
4. **Generate documents** — SOAP note, referral letter, patient summary, and more

---

## Document types

| Document | What it contains |
|----------|-----------------|
| SOAP Note | Full structured note: Subjective, Objective, Assessment, Plan |
| After-Visit Summary | Plain-language summary for the patient file |
| Discharge Instructions | Step-by-step home care instructions |
| Prescription | Drug names, doses, routes, frequencies, durations |
| Follow-Up Plan | Return schedule, monitoring instructions, warning signs |
| Lab Order | Diagnostic tests ordered with rationale |
| Referral Letter | Clinical letter for a specialist or imaging centre |
| Shift Handoff | Clinical handoff summary for shift change |
| Invoice | Itemised charges based on services rendered |

---

## Key features

- **Ambient consultation** — records both voices in the room, no handoff required
- **Dictation mode** — solo provider dictation with voice commands
- **Lab extraction** — values mentioned aloud become structured discrete lab results
- **ICD-10 coding** — diagnosis codes suggested automatically after publish
- **CPT billing** — E&M level determined from visit complexity
- **Patient profiles** — living clinical profiles built from every encounter on record
- **Case Reasoning** — AI clinical assistant for differentials, drug interactions, and more
- **Patient Companion** — a private AI chat link for patients to ask questions about their visit, 24/7
- **Scheduling** — week-view appointment calendar with one-click encounter start

---

## Not a replacement for clinical judgment

The platform generates documentation and provides AI-assisted reasoning. It is not a diagnostic tool and never overrides clinical expertise. Diagnoses are always entered by you. The AI assists — you decide.
`,
  },

  // ─── Encounters ───────────────────────────────────────────────────────────

  {
    slug: 'recording-a-encounter',
    title: 'Recording an Encounter',
    description: 'How to start and stop recordings, choosing between ambient and dictation modes.',
    category: 'encounters',
    readTime: 4,
    content: `# Recording an Encounter

There are two recording modes: **Ambient Consultation** and **Dictate Note**. You choose when you start a new encounter.

---

## Choosing a mode

**New Encounter → select mode → Record**

| Mode | When to use |
|------|------------|
| Ambient Consultation | Doctor–patient consultation in the room. Both voices captured. |
| Dictate Note | Provider dictating solo — notes after the fact, addenda, billing entries. |

---

## Ambient Consultation

Ambient mode picks up the full room — you don't need to hold a microphone or hand anything to the patient. Speak naturally. Both voices are transcribed and the platform extracts clinical facts from the whole dialogue.

**What gets extracted:**
- Presenting complaints and history from the patient's own words
- Examination findings as you narrate them
- Lab values you read aloud — extracted as discrete structured results
- Assessment and plan from your discussion with the patient

**Start flow:** New Encounter → Ambient Consultation → Record

---

## Dictation Mode

Dictation mode is for solo provider speech only. Use it when the patient isn't present or you're adding notes after the consultation.

Supports voice commands for editing and navigation. Dictated notes go through the same facts pipeline as ambient recordings — ICD-10 coding and document generation work the same way.

**Start flow:** New Encounter → Dictate Note → Record

---

## During recording

Speak naturally. You don't need to slow down or pause between topics.

### Example — history and presenting complaint

> "James is a 58-year-old male presenting with fatigue and shortness of breath on exertion for the past few weeks. He has a background of Type 2 diabetes on metformin and hypertension. HbA1c is 8.4%, up from 7.9 at his last visit. Fasting glucose 11.2."

### Example — examination

> "Blood pressure today is 152 over 94. Heart sounds normal, chest is clear, no peripheral oedema."

### Example — plan

> "We'll increase metformin to 1 gram twice daily. Starting atorvastatin 40 milligrams at night for the LDL. I want iron studies today, and I'm referring to cardiology for a 24-hour ECG."

---

## Tips for better extraction

- **State demographics early** — age, sex, and key history give the AI context from the start
- **Say drug names in full** — "atorvastatin" not "the statin"
- **Include values and units** — "HbA1c 8.4 percent", "BP 152 over 94"
- **Read lab results aloud** — they're extracted as discrete structured results automatically
- **Cover the full picture** — history, exam, assessment, and plan all in one recording is fine

---

## Stopping and reviewing

1. Click **Stop** when you're done
2. The platform processes the recording — usually takes a few seconds
3. Review the extracted facts in the **Facts** panel
4. Click **Publish** when you're ready — this triggers coding, billing, profile update, and patient companion creation

---

## Audio tips

- Built-in laptop microphone works fine in a quiet room
- On mobile, hold the phone at mid-chest level
- Avoid background noise from running water or HVAC vents
- The browser needs microphone permission — allow it when prompted
`,
  },
  {
    slug: 'understanding-facts',
    title: 'Understanding Clinical Facts',
    description: "What facts are, how they're extracted, and how to use the facts panel.",
    category: 'encounters',
    readTime: 3,
    content: `# Understanding Clinical Facts

Clinical facts are the structured data extracted from your recordings. They're the foundation for everything — document generation, ICD-10 coding, AI reasoning, and patient profiles.

---

## What is a fact?

A fact is a single piece of clinical information pulled from your recording. For example, from:

> "Blood pressure today is 152 over 94 — a bit high."

The platform extracts:

> **Blood Pressure** → 152/94 mmHg (group: Physical Exam Findings)

Each fact has:
- **Text** — the content
- **Group** — the clinical category

---

## Fact groups

| Group | Examples |
|-------|---------|
| Patient Demographics | Age, sex, chief complaint |
| History | Presenting complaint, duration, prior illness |
| Physical Exam Findings | Vitals, auscultation, palpation findings |
| Current Medications | Drug names, doses, frequencies |
| Lab Results | HbA1c, LDL, haemoglobin, creatinine values |
| Diagnostic Imaging | X-ray, ultrasound, MRI findings |
| Assessment | Diagnosis, working diagnosis |
| Plan | Treatment, prescriptions, follow-up instructions |

---

## Lab results

Lab values mentioned aloud during a consultation are extracted as discrete structured results — not just as text, but as named values with units and abnormal flags. See [Lab Result Extraction](/docs/lab-extraction) for details.

---

## The facts panel

After stopping a recording, the **Facts** panel shows all extracted facts grouped by category. Review them before publishing.

If something is missing or incorrect:
- Minor errors are fine to leave — they won't affect document quality much
- Major errors (wrong medication dose, wrong patient demographics) are worth noting in your provider notes

---

## Facts across multiple recordings

Facts from all recordings in an encounter are combined for document generation. If there are conflicts between recordings, the platform runs **fact reconciliation** to flag contradictions.

See [Multi-Recording & Follow-Ups](/docs/multi-recording) for details.

---

## Provider notes vs facts

Facts come from your recording. **Provider notes** are what you type directly — your diagnosis and treatment plan. These are combined with recording facts when generating documents.

---

## Why facts matter

Document generation, ICD-10 coding, CPT billing, and patient profile updates all work from the same extracted facts. The more complete the recording, the better every downstream output will be.
`,
  },
  {
    slug: 'multi-recording',
    title: 'Multi-Recording & Follow-Ups',
    description: 'Adding multiple recordings to one encounter and how fact reconciliation works.',
    category: 'encounters',
    readTime: 4,
    content: `# Multi-Recording & Follow-Ups

A single encounter can have multiple recordings. This is useful for capturing different clinical events — a history, an examination, a post-procedure note, or a follow-up call — all tied to the same patient record.

---

## Adding a second recording

1. On the encounter detail page, click **Add Recording**
2. Record your additional notes and save
3. The detail page now shows both recordings in the **Facts** tab

Each recording is stored separately and labelled by phase and order.

---

## When to use multiple recordings

**Scenario 1: History then exam**
Record the history and presenting complaint, then add a second recording after the physical examination.

**Scenario 2: Pre- and post-procedure**
Record your pre-procedure assessment, then add a post-procedure recording summarising what was done, any complications, and discharge instructions.

**Scenario 3: Follow-up call**
Add a recording when the patient calls with an update. This keeps everything in one encounter record.

**Scenario 4: Results come back**
Lab results return after the encounter. Record your interpretation and amended plan as a follow-up recording.

---

## Fact reconciliation

When you have two or more recordings, the platform automatically compares facts and looks for **conflicts** — cases where the same clinical data appears with different values.

After adding a second recording, facts are labelled with coloured indicators:

| Colour | Meaning |
|--------|---------|
| Green | Confirmed — same fact in both recordings |
| Blue | Updated — value changed between recordings |
| Red | Contradiction — incompatible values that need resolving |
| Purple | New — fact only in the later recording |
| Grey | Unchanged — not mentioned in the newer recording |

---

## Resolving contradictions

Red facts are contradictions. The platform shows the value from each recording and asks you to choose:

- **Accept New** — use the value from the more recent recording
- **Keep Old** — keep the original value

Once resolved, the contradiction is marked. When documents are generated, the resolved value is used.

---

## Documents use all recordings

When you generate a document, facts from all recordings are combined automatically. If there are unresolved contradictions, the newer value is used by default.

---

## Phases

You can tag each recording with a clinical phase:

- **History** — initial complaint and background
- **Exam** — physical examination findings
- **Assessment** — working diagnosis and differential
- **Follow-up** — post-encounter or next-day update

Phases are optional but help keep multiple recordings organised on longer cases.
`,
  },
  {
    slug: 'generating-documents',
    title: 'Generating Clinical Documents',
    description: 'How to generate SOAP notes, referral letters, and all other document types.',
    category: 'encounters',
    readTime: 5,
    content: `# Generating Clinical Documents

Document generation is the main output of an encounter. From your recordings and provider notes, the platform generates professional clinical documents in seconds.

---

## Before you generate

You need:
1. At least one **recording** saved to the encounter
2. A **diagnosis** entered in the Provider Notes section (strongly recommended)

The more complete your recording — history, exam findings, assessment, plan — the better the documents.

---

## Adding provider notes

On the encounter detail page, find the **Provider Notes** section:

- **Diagnosis** — your working or final diagnosis (e.g. "Type 2 diabetes mellitus with hyperglycaemia, iron deficiency anaemia")
- **Treatment Plan** — what you're prescribing and doing

These notes are included in every document. The diagnosis flows into the Assessment section of the SOAP note; the treatment plan flows into the Plan section.

---

## Selecting document types

In the **Workflow Panel**, click the document type chips to select which documents you want:

| Chip | Document |
|------|---------|
| SOAP Note | Full structured clinical note |
| After-Visit Summary | Plain-language record for the patient file |
| Discharge Instructions | Step-by-step care instructions to take home |
| Prescription | Drug details formatted for dispensing |
| Follow-Up Plan | Return visit schedule and monitoring instructions |
| Lab Order | Diagnostic tests ordered |
| Referral Letter | Clinical letter for a specialist |
| Shift Handoff | Clinical handoff summary |

---

## Generating

1. Select the document types you want
2. Ensure your provider notes are filled in
3. Click **Generate Documents**
4. Documents appear in the **Documents** tab as they complete

SOAP notes typically take 5–8 seconds. All documents together usually complete within 15–20 seconds.

---

## Editing documents

Everything is editable. Click into any section of a document and type — changes autosave immediately.

Common edits:
- Correct a medication dosage
- Add a clinical detail that wasn't in the recording
- Adjust the tone for patient-facing documents

---

## Regenerating

If you update your provider notes (e.g. revise the diagnosis after results come back), click **Regenerate** on any document. It uses your current notes and all recordings to produce a fresh version.

---

## Documents are autosaved

Documents are automatically saved to the encounter record. You don't need to export or save manually.
`,
  },
  {
    slug: 'evidence-files',
    title: 'Uploading Evidence Files',
    description: 'How to attach lab reports, imaging, and referral letters to an encounter.',
    category: 'encounters',
    readTime: 3,
    content: `# Uploading Evidence Files

You can attach external files to any encounter — lab result PDFs, imaging reports, referral letters, or any other clinical document. These feed into your document generation as additional context.

---

## Supported file types

- PDF (lab results, referral letters, reports)
- Images (JPEG, PNG — for imaging, clinical photos)
- Most document formats are accepted

---

## Uploading a file

1. On the encounter detail page, find the **Evidence Files** panel
2. Drag and drop a file, or click to browse
3. The file uploads and appears in the evidence list

The platform auto-guesses the category from the filename:
- "lab_results.pdf" → Lab Result
- "xray.jpg" → Imaging
- "referral.pdf" → Referral

---

## Categories

| Category | Use it for |
|----------|-----------|
| Lab Result | Blood work, urinalysis, culture results |
| Imaging | Radiographs, ultrasound images, CT/MRI |
| Referral | Letters from or to specialists |
| Other | Anything else |

---

## Adding notes to a file

Click the notes field next to any uploaded file to add your interpretation:

> "Chest X-ray — no consolidation, no pleural effusion. Cardiomegaly borderline."

These notes are treated as clinical facts and included in document generation. Even if the platform can't read the PDF contents directly, your interpretation note is used.

---

## How evidence feeds into documents

When you generate documents, your evidence file notes are added as additional clinical context alongside your recording facts. A chest X-ray interpretation will appear in the Objective section of the SOAP note and inform the Assessment.

---

## Viewing evidence files

All uploaded files appear in the Evidence tab. Click any file to view it in the browser. Files are stored securely and attached permanently to the encounter record.
`,
  },
  {
    slug: 'scheduling',
    title: 'Scheduling & Appointments',
    description: 'How to book appointments, use the week calendar, and start encounters from the schedule.',
    category: 'encounters',
    readTime: 3,
    content: `# Scheduling & Appointments

The Schedule page is a full-viewport week calendar for managing appointments. Click any time slot to book; click any appointment to start the encounter.

---

## Navigating the calendar

**Sidebar → Schedule**

The calendar shows Monday through Sunday for the current week. Use the **← →** arrows to move between weeks.

- **Current time** — shown as a red line in today's column
- **On load** — the calendar scrolls to the current time automatically
- **Mobile** — shows a single-day view

---

## Booking an appointment

Click any empty time slot to open the booking dialog. It pre-fills the date and time from the slot you clicked (snapped to 30-minute intervals).

**Fields:**
- Patient name — free text, autocompletes from your patient list
- Date and time — pre-filled, adjustable
- Duration — 15, 30, 45, or 60 minutes
- Appointment type — new patient, follow-up, telehealth, procedure, other
- Reason — optional
- Notes — optional

---

## Starting an encounter from the schedule

Click any appointment block to open the detail panel.

**Start Encounter** creates a draft encounter, links it to the appointment, and takes you directly to the recording screen. The appointment status updates to In Progress automatically.

Other actions from the detail panel:
- **View Patient** — opens the patient's profile
- **No Show** — marks the appointment as no-show
- **Cancel** — cancels the appointment

---

## Appointment statuses

| Status | Meaning |
|--------|---------|
| Scheduled | Booked, not yet started |
| In Progress | Encounter started |
| Completed | Encounter published |
| No Show | Patient did not attend |
| Cancelled | Appointment cancelled |

---

## Home page

Upcoming appointments (next 7 days) are shown on the home page alongside pending encounters and overdue follow-ups.
`,
  },

  // ─── Patients ─────────────────────────────────────────────────────────────

  {
    slug: 'patient-profiles',
    title: 'Patient Profiles',
    description: 'How living clinical profiles are built automatically from every encounter on record.',
    category: 'patients',
    readTime: 4,
    content: `# Patient Profiles

Every patient has a living clinical profile that is built automatically from their encounter history. After each published encounter, the profile rebuilds — no manual maintenance required.

---

## What the profile contains

- **Clinical narrative** — a 2–4 sentence plain-English summary of the patient's clinical picture
- **Active problems** — current diagnoses with ICD-10 codes
- **Current medications** — drugs, doses, and frequencies
- **Allergies** — allergens, reactions, and severity
- **Care gaps** — outstanding preventive or monitoring items
- **Encounter count** — total published encounters on record

---

## How profiles are built

When you publish an encounter, a background process reads all prior encounter facts plus the new encounter's facts and produces a structured profile. The "Built from N encounters" badge on the profile page updates when it's done.

You don't need to do anything — publishing an encounter is all it takes.

---

## Patient list

On the Patient Records page, each row is enriched with live profile data:

- **Condition chips** — up to 3 active problems (administrative Z-codes are filtered out)
- **Allergy indicator** — count of documented allergies (NKA/NKDA entries are filtered)
- **Visit count** — total encounters
- **Last visit** — most recent published encounter date

---

## First encounter

After a patient's very first encounter is published, the profile build runs and the badge appears. From the second encounter onwards, the profile reflects cumulative history.

---

## Care gaps

The profile flags outstanding clinical items — things that were flagged in one encounter but haven't been followed up. For example:

- A referral that was ordered but no follow-up recorded
- A monitoring item (e.g. "recheck HbA1c in 3 months") that hasn't appeared since
- A medication that was started without a documented review

These appear in the Care Gaps section and feed into the home page's overdue follow-up list.

---

## Reviewing the profile before an encounter

Open a patient from **Patient Records** before starting an encounter. The profile gives you the clinical briefing — active problems, current medications, recent history — so you walk in with context.
`,
  },
  {
    slug: 'patient-records',
    title: 'Patient Records',
    description: 'Searching, filtering, and navigating your patient list.',
    category: 'patients',
    readTime: 2,
    content: `# Patient Records

**Sidebar → Patient Records**

The patient list shows every patient in your practice with a live clinical summary from their profile.

---

## Searching

Use the search bar to filter by patient name. Results update as you type.

---

## Sorting

Toggle the sort button between:
- **Recent** — patients sorted by most recent encounter date
- **A–Z** — alphabetical by name

---

## What each row shows

- **Name** — patient full name
- **Demographics** — age, sex, and MRN if set
- **Condition chips** — up to 3 active problems
- **Allergy indicator** — number of documented allergies (red chip with warning icon)
- **Visit count + last seen** — on the right side

---

## Creating a new patient

Click **New Patient** → enter the patient's name → Create. You're taken to their profile page immediately. Encounter history, demographics, and full profile build up from there.

---

## Opening a patient

Click any patient row to open their profile. From there you can:
- View their full clinical profile (problems, medications, allergies, narrative)
- See all prior encounters
- Start a new encounter
`,
  },

  // ─── AI Features ──────────────────────────────────────────────────────────

  {
    slug: 'lab-extraction',
    title: 'Lab Result Extraction',
    description: 'How lab values mentioned aloud become structured discrete results automatically.',
    category: 'ai-features',
    readTime: 3,
    content: `# Lab Result Extraction

Lab values mentioned during an ambient consultation are automatically extracted as discrete structured results. You read the values aloud; the platform parses and structures them with no manual entry.

---

## How it works

When you say something like:

> "HbA1c is 8.4, up from 7.9 last visit. LDL is 3.8. Haemoglobin 11.8 — mildly low. Creatinine 98, which is stable."

The platform extracts:

| Test | Value | Unit | Flag |
|------|-------|------|------|
| HbA1c | 8.4 | % | High |
| LDL cholesterol | 3.8 | mmol/L | High |
| Haemoglobin | 11.8 | g/dL | Low |
| Creatinine | 98 | µmol/L | — |

These appear in the **Lab Results** section of the Facts panel.

---

## Viewing lab results

In the Facts panel after recording, scroll to **Lab Results**. Each value is shown with its test name, result, unit, and any abnormal flag.

---

## Downstream uses

Extracted lab results feed into:
- **SOAP note** — appear in the Objective section automatically
- **ICD-10 coding** — high HbA1c suggests E11.65, low haemoglobin suggests D64.9
- **Patient profile** — abnormal values are captured in active problems and care gaps
- **Case Reasoning** — the AI knows the lab values when you ask clinical questions about the case

---

## Tips for better extraction

- State the test name clearly before the value: *"HbA1c is 8.4"* not *"the A1c came back at 8.4"*
- Include units where natural: *"haemoglobin 11.8 grams per decilitre"*
- Comment on abnormality: *"LDL is 3.8 — high"* helps flag it correctly
- Results read aloud in sequence are all captured: you can read through a full results printout and every value is extracted

---

## Review before publishing

All extracted lab results are shown in the Facts panel before you publish. Review them for accuracy — they feed directly into coding and the patient profile.
`,
  },
  {
    slug: 'case-reasoning',
    title: 'Case Reasoning AI',
    description: 'How to use the AI clinical assistant for differentials, drug interactions, and more.',
    category: 'ai-features',
    readTime: 4,
    content: `# Case Reasoning AI

Case Reasoning is an AI clinical assistant that lets you think through a case conversationally. Ask it about differentials, drug doses, interactions, diagnostic plans, or anything else clinical — it responds in 10–15 seconds with evidence-based answers.

---

## Opening Case Reasoning

Click **Case Reasoning** in the sidebar. You can:

- Start a **standalone chat** (no case attached — useful for general drug or dosing questions)
- Start a chat **linked to an encounter** (the AI knows all the clinical facts from your recording)

To link an encounter, open a saved encounter and look for the Case Reasoning section on the detail page.

---

## What you can ask

**Differential diagnoses**
> "What are the top differentials for a 58-year-old male with fatigue, mild anaemia, and elevated creatinine?"

**Diagnostic plans**
> "What tests would you run first for a patient with new-onset polyuria and polydipsia?"

**Drug interactions**
> "Are there any interactions between metformin and atorvastatin?"

**Drug doses**
> "What's the appropriate metoprolol dose for rate-controlled AFib in a 72kg patient?"

**Clinical reasoning**
> "We found elevated ALT and AST but normal bilirubin in a 45-year-old with fatigue. What does that suggest?"

**Literature questions**
> "Is there evidence for early mobilisation in ICU patients on mechanical ventilation?"

---

## Starter prompts

When an encounter is linked, you'll see suggested prompts:

- **Top differentials** — ranked differentials with confirmatory tests
- **Drug interactions** — checks all current medications
- **Diagnostic plan** — prioritised tests based on the presentation
- **Summarise findings** — concise summary of the clinical picture

Click any to send instantly.

---

## Multi-turn conversations

Ask follow-up questions — the AI remembers the context of the conversation:

> You: "What are the differentials for this patient's anaemia?"
> AI: *[lists differentials with probabilities]*
> You: "If it's CKD-related, how does that change the management?"
> AI: *[answers in context of the previous response]*

Conversations are saved automatically.

---

## Response time

Expect 10–15 seconds per response. The AI is doing genuine clinical reasoning, not keyword matching.

---

## Important notes

- **The AI doesn't replace your clinical judgment.** It supports your decision-making.
- **Always verify drug doses** against your preferred clinical reference for the final prescription.
- **The AI knows this encounter's facts.** If you ask about the patient's weight for a dose calculation, it uses the weight from your recording.
`,
  },
  {
    slug: 'patient-companion',
    title: 'The Patient Companion',
    description: 'How to create and share an AI companion link for patients after an encounter.',
    category: 'ai-features',
    readTime: 4,
    content: `# The Patient Companion

The Patient Companion is a private AI chat link you can share with a patient after their appointment. The AI knows everything about that specific visit and can answer their questions 24/7 — without you being involved.

No login required. The patient just opens the link.

---

## What it does

Imagine the patient gets home and wonders: *"What was that medication called again? When do I take it? What warning signs should I watch for?"*

Instead of calling the clinic, they open the link and ask the AI directly. It answers accurately from the encounter data — dosages, instructions, warning signs, follow-up dates — everything the provider recorded.

---

## Creating a companion link

1. Complete the encounter and generate at least a SOAP note or discharge instructions
2. Click **Publish** to finalise the encounter
3. Click **Share with Patient** — a unique link is generated
4. Copy and share the link: SMS, email, or print it on the discharge sheet

---

## What the patient sees

The companion page shows:
- Your clinic name and the patient's details
- A welcome message summarising the visit in plain language
- Suggested questions to get them started
- A chat box for their own questions

---

## What the AI knows

The AI has access to everything in the encounter:
- Diagnosis and treatment plan
- Medication names, doses, frequency, duration, and instructions
- Home care instructions and activity restrictions
- Follow-up date and reason
- Warning signs to watch for
- Your clinic contact and emergency phone number
- Invoice/charges (if generated)

---

## What the AI doesn't know

The AI **only** knows about this specific encounter. It cannot:
- Access other encounters for this patient
- Look up clinical information beyond what was recorded
- Recommend changes to the treatment plan
- Act as an emergency triage service

If the patient asks something outside the encounter, the AI directs them to call the clinic.

---

## Link management

- Companion links are **active** after publishing until deactivated
- You can deactivate a link from the encounter detail page
- Links expire after a set period (configurable in org settings)

---

## Privacy

The companion link contains a long, randomly generated token — it cannot be guessed. Only people you share the link with can access it.

---

## Updating the companion

If you add an addendum to the encounter after publishing (e.g. lab results return), the companion AI is automatically updated to include the new information.
`,
  },

  // ─── Billing & Coding ─────────────────────────────────────────────────────

  {
    slug: 'medical-coding',
    title: 'ICD-10 & CPT Coding',
    description: 'How diagnosis and procedure codes are suggested automatically after every encounter.',
    category: 'billing',
    readTime: 4,
    content: `# ICD-10 & CPT Coding

After an encounter is published, the platform automatically extracts ICD-10 diagnosis codes and CPT procedure codes from the encounter. A coder reviews and confirms — the system proposes, the coder disposes.

---

## What happens after publish

Publishing an encounter triggers the coding pipeline in the background:

1. ICD-10 codes are extracted from the clinical facts and transcript
2. CPT codes are determined from encounter type and visit complexity
3. Codes appear in the **Medical Coding** panel, usually within 30 seconds

---

## ICD-10 codes

Diagnosis codes are extracted from everything discussed in the encounter. Examples from a typical primary care visit:

| Code | Description |
|------|------------|
| E11.65 | Type 2 diabetes mellitus with hyperglycaemia |
| I10 | Essential hypertension |
| D64.9 | Anaemia, unspecified |
| E78.5 | Hyperlipidaemia, unspecified |
| R06.09 | Dyspnoea |

The more complete the clinical facts (including lab values read aloud), the more accurate the coding.

---

## CPT codes

E&M level codes (99202–99215) are determined automatically from:

- Number of diagnoses addressed
- Amount of data reviewed (labs, imaging, external records)
- Management decision complexity

For example, an established patient with multiple chronic conditions, lab review, and new prescriptions will typically generate **99214** (moderate complexity).

The billing panel shows the estimated dollar value for the coded visit.

---

## Coder review

In the **Medical Coding** panel, the coder can:
- Review all suggested codes
- Add codes that weren't captured
- Remove codes that don't apply
- Confirm — moving the encounter to billing-ready status

For straightforward encounters, confirmation takes seconds. For complex cases, the suggestions are a strong starting point.

---

## From coding to billing

Confirmed CPT codes flow directly into the billing panel. The estimated visit value is calculated from the confirmed codes and shown immediately. Nothing falls off the billing cycle.

---

## Accuracy note

Code accuracy depends on the quality of the clinical facts. Lab values, examination findings, and clearly stated diagnoses all contribute to correct code selection. Review the Facts panel before publishing if accuracy is critical for a complex case.
`,
  },
  {
    slug: 'billing',
    title: 'Billing & Invoices',
    description: 'Setting up your billing catalog, reviewing extracted items, and generating invoices.',
    category: 'billing',
    readTime: 5,
    content: `# Billing & Invoices

The platform automatically extracts billable items from encounter recordings and matches them to your price list. After each encounter, you review extracted items, add anything missed, and generate a formatted invoice.

---

## Setting up your billing catalog

Before billing extraction is useful, add your services to the catalog.

Navigate to **Billing → Catalog** and add your items:

- **Name** — the service name (e.g. "Office Visit", "CBC Panel", "Iron Studies")
- **Code** — your internal code (e.g. "EXAM-001", "LAB-CBC")
- **Category** — Exam, Procedure, Lab, Medication, Supply, Imaging, Hospitalization, or Other
- **Price** — base price in your currency
- **Taxable** — whether tax applies to this item

---

## How billing extraction works

When you save an encounter recording, the platform analyses the clinical facts and matches them to your catalog items in the background.

For example, if your recording includes:
> "I want to check iron studies today... starting atorvastatin 40 milligrams at night... I'm referring to cardiology."

The platform matches:
- Iron Studies → your catalog item
- Atorvastatin 40mg → your catalog item
- Cardiology Referral → your catalog item

These appear in the **Billing** section of the encounter as **Planned Services**.

---

## Two-phase billing

**Phase 1 — Prospective (planned):** Items mentioned during the encounter as things you're going to do.

**Phase 2 — Retrospective (completed):** Items confirmed in a post-encounter recording.

The system compares planned vs completed. If anything was done but not planned, it flags those as **Missed Items** — revenue that would otherwise be lost.

---

## Reviewing billing items

On the encounter detail page, open the **Billing** section:

- **Confirmed items** — planned and completed, green tick
- **Missed items** — done but not planned, amber highlight — these are the money savers
- **Cancelled items** — planned but not done, excluded from invoice

For each missed item, choose to **Add to Invoice** or **Dismiss**.

---

## Adjusting items

Before generating the invoice:
- Edit quantities (e.g. "Iron Studies × 1")
- Override the price for a specific item
- Add items manually from your catalog

---

## Generating an invoice

Click **Generate Invoice**. The platform creates a formatted invoice showing:

- Itemised charges with codes, quantities, and prices
- Subtotal, tax (if configured), and total
- Revenue recovery summary: "You almost missed $X in charges"

The invoice is saved to the encounter and can be printed or exported.

---

## Tax settings

Configure at **Settings → Billing**:

- **Tax rate** — your VAT, GST, or sales tax rate
- **Tax name** — label on invoices ("VAT", "GST", "Sales Tax")
- **Tax mode:**
  - *Tax-exclusive* (US, Canada) — tax added on top
  - *Tax-inclusive* (UK, EU, Australia) — prices include tax, shown as a breakdown
`,
  },

  // ─── Settings ─────────────────────────────────────────────────────────────

  {
    slug: 'team-settings',
    title: 'Team & Settings',
    description: 'Managing your team members, roles, locations, and subscription.',
    category: 'settings',
    readTime: 4,
    content: `# Team & Settings

Manage your practice details, team members, and subscription from the Settings pages.

---

## Organisation settings

**Settings → Organisation**

- **Practice name** — appears on all generated documents
- **Clinic phone** — included in patient companion and discharge documents
- **Emergency phone** — shown to patients and caregivers in the companion
- **Clinic address** — appears on invoices and referral letters

Keep these up to date — they're pulled into every document you generate.

---

## Team management

**Settings → Team**

### Roles

| Role | What they can do |
|------|-----------------|
| Owner | Everything, including billing and team management |
| Admin | Full clinical access, cannot manage billing |
| Provider | Full clinical access — create, record, publish encounters |
| Practice Admin | Location-scoped access — only sees patients/encounters at assigned locations |

### Inviting a team member

1. Click **Invite** on the team page
2. Enter their email address and select their role
3. They receive an email with a link to join your organisation
4. Once they accept, they appear in the team list as an active member

Invitations expire after 7 days. Resend from the team page if needed.

### Seat limits

Your plan determines how many active members you can have:

- **Solo** — 1 seat
- **Practice** — up to 5 seats
- **Multi-Location** — unlimited

---

## Locations

**Settings → Locations** (Multi-Location plan)

If you have multiple clinic locations, each can have its own name, address, and phone number. Patients and encounters can be assigned to a specific location.

Practice Admin members can be scoped to specific locations — they only see patients and encounters at their assigned clinic.

---

## Billing & subscription

**Settings → Billing**

- View your current plan and billing status
- See encounter usage this billing period
- Upgrade or downgrade your plan
- Manage payment method and view invoices → **Manage Subscription** opens the Stripe billing portal

### Plans

| Plan | Price | Best for |
|------|-------|---------|
| Solo | $79/month | Single provider practice |
| Practice | $149/month | Small multi-provider clinic |
| Multi-Location | $299/month | Multiple clinic locations |

All plans include a 14-day free trial.

---

## Dark mode

Click the **dark mode toggle** in Settings to switch themes. Your preference is saved across sessions.

---

## Getting help

Use the **⌘K Ask AI** feature to ask any question about the platform in plain English, or contact support from the Settings page.
`,
  },
];

// Helper to get all slugs for static generation
export const getAllSlugs = () => DOCS.map(d => d.slug);

// Helper to get article by slug
export const getArticleBySlug = (slug: string) => DOCS.find(d => d.slug === slug);

// Helper to get articles by category
export const getArticlesByCategory = (category: DocCategory) =>
  DOCS.filter(d => d.category === category);

// All content concatenated for AI search context
export const getAllDocsContent = () =>
  DOCS.map(doc => `# ${doc.title}\n\n${doc.content}`).join('\n\n---\n\n');
