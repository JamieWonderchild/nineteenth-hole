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
  | 'ai-features'
  | 'billing'
  | 'settings';

export const CATEGORY_LABELS: Record<DocCategory, string> = {
  'getting-started': 'Getting Started',
  'encounters': 'Encounters',
  'ai-features': 'AI Features',
  'billing': 'Billing',
  'settings': 'Settings & Team',
};

export const CATEGORY_ORDER: DocCategory[] = [
  'getting-started',
  'encounters',
  'ai-features',
  'billing',
  'settings',
];

export const DOCS: DocArticle[] = [
  {
    slug: 'overview',
    title: 'Welcome to [PRODUCT_NAME]',
    description: 'An overview of what [PRODUCT_NAME] does and how it fits into your encounter workflow.',
    category: 'getting-started',
    readTime: 3,
    content: `# Welcome to [PRODUCT_NAME]

[PRODUCT_NAME] is a clinical documentation assistant for clinicians. It helps you record encounters by voice, automatically extract clinical facts, generate professional documents, and share visit summaries with patients — all without typing.

---

## How it works

The core idea is simple: **you talk, [PRODUCT_NAME] listens**.

During a encounter, you record your clinical notes by voice. [PRODUCT_NAME] transcribes your speech and automatically extracts structured clinical facts — patient demographics, presenting complaints, examination findings, medications, assessments, and plans. From those facts, it can generate any document you need in seconds.

### The encounter flow

\`\`\`
Record → Review Facts → Save → Generate Documents → Share with Patient
\`\`\`

1. **Record** — speak naturally during or after your encounter
2. **Review facts** — check the extracted clinical data, add your diagnosis
3. **Save** — the encounter is stored and you land on the detail page
4. **Generate documents** — pick which document types you need and click Generate
5. **Share** — publish the encounter and share a companion link with the patient

---

## What [PRODUCT_NAME] generates

| Document | What it contains |
|----------|-----------------|
| SOAP Note | Full structured note with Subjective, Objective, Assessment, Plan |
| After-Visit Summary | Plain-language visit summary for the client file |
| Discharge Instructions | Step-by-step home care instructions for the patient |
| Prescription | Drug names, doses, routes, frequencies, durations |
| Follow-Up Plan | Return schedule, monitoring instructions, warning signs |
| Lab Order | Diagnostic tests ordered with rationale |
| Referral Letter | Professional clinical letter for a specialist or imaging center |
| Shift Handoff | Clinical handoff summary for shift change |
| Invoice | Itemised charges based on services rendered |

---

## Key features

- **Voice recording** — record once, get everything
- **Multi-recording** — add follow-up recordings (exam, post-procedure notes) that all feed into the same encounter
- **Case Reasoning** — ask an AI clinical assistant anything about the case
- **Patient Companion** — a private AI chat link that gives your patient instant answers about their visit, 24/7
- **Billing** — automatic extraction of billable items from recordings so nothing gets missed

---

## Not a replacement for clinical judgment

[PRODUCT_NAME] generates documentation and provides AI-assisted reasoning. It is not a diagnostic tool and never overrides clinical expertise. Diagnoses are always entered by you. The AI assists — you decide.
`,
  },
  {
    slug: 'recording-a-encounter',
    title: 'Recording a Encounter',
    description: 'How to start and stop recordings, what to say, and tips for best results.',
    category: 'encounters',
    readTime: 4,
    content: `# Recording a Encounter

[PRODUCT_NAME] records your voice and converts it into structured clinical data in real time. You don't need to change how you work — just speak naturally.

---

## Starting a recording

1. Open a patient's profile from **Patient Records**
2. Click **New Encounter** to create a draft
3. On the encounter detail page, click **Begin Encounter**
4. You're taken to the recording page — click the **microphone button** to start

The recording page shows two panels:
- **Left** — live transcript of everything you say
- **Right** — clinical facts being extracted in real time

---

## What to say

Speak naturally, as if you were dictating to a colleague. [PRODUCT_NAME] handles the structure automatically.

### Example — history and presenting complaint

> "This is Alex, a 45 year old male presenting with chest pain and shortness of breath starting this morning. He reports the pain is 7 out of 10, substernal, radiating to the left arm. No prior cardiac history. Current medications: lisinopril 10mg daily for hypertension. No known drug allergies."

### Example — physical examination

> "On examination — temperature 37.1, heart rate 98, blood pressure 142 over 88, respiratory rate 18, oxygen saturation 96% on room air, weight 82 kilograms. Heart sounds regular, no murmurs. Lungs clear to auscultation bilaterally. Abdomen soft, non-tender. No peripheral oedema."

### Example — assessment and plan

> "Assessment: acute coronary syndrome, rule out NSTEMI. Plan: aspirin 325mg stat, nitroglycerin sublingual as needed, IV access obtained, 12-lead ECG ordered, troponin and BMP stat. Cardiology consult requested. Admit to telemetry for monitoring."

---

## Tips for better fact extraction

- **State patient demographics clearly** — "45 year old male with hypertension" gives better context than just "middle-aged man"
- **Say drug names in full** — "metoprolol" not "Lopressor" (although both work)
- **Include units** — "38.8 degrees" and "34 kilograms" give better facts than raw numbers alone
- **Speak at a normal pace** — no need to slow down or pause between topics
- **Cover the full picture in one recording** — history, exam, assessment, and plan all in one is fine

---

## Stopping and saving

1. Click **Stop** when you're finished
2. Review the extracted facts — check them for accuracy
3. Add your **diagnosis** and **treatment plan** in the provider notes fields
4. Click **Save** — you're redirected to the encounter detail page

---

## Multiple recordings

You can add more recordings to the same encounter — for example, a separate recording after the procedure, or a follow-up the next day. Each recording is kept separate, and all facts feed into your documents.

See [Multi-Recording & Follow-Ups](/docs/multi-recording) for details.

---

## Audio tips

- Use a decent microphone — built-in laptop mics work fine in a quiet room
- On mobile, hold the phone at mid-chest level while talking
- Avoid background noise if possible (running water, air conditioning vents)
- The browser needs microphone permission — allow it when prompted
`,
  },
  {
    slug: 'understanding-facts',
    title: 'Understanding Clinical Facts',
    description: 'What facts are, how they\'re extracted, and how to use the facts panel.',
    category: 'encounters',
    readTime: 3,
    content: `# Understanding Clinical Facts

Clinical facts are the structured data [PRODUCT_NAME] extracts from your recordings. They're the foundation for everything — document generation, AI reasoning, and reconciliation.

---

## What is a fact?

A fact is a single piece of clinical information pulled from your recording. For example, from the sentence:

> "Temperature is 38.8 degrees Celsius"

[PRODUCT_NAME] extracts:

> **Temperature** → 38.8°C (group: Physical Exam Findings)

Each fact has:
- **Text** — the content of the fact
- **Group** — the clinical category it belongs to

---

## Fact groups

Facts are automatically sorted into groups:

| Group | Examples |
|-------|---------|
| Patient Demographics | Age, sex, weight, chief complaint |
| History | Presenting complaint, duration, prior illness |
| Physical Exam Findings | Vitals, auscultation, palpation findings |
| Current Medications | Drug names, doses, frequencies |
| Lab Results | CBC, chemistry, urinalysis values |
| Diagnostic Imaging | X-ray, ultrasound findings |
| Assessment | Diagnosis, working diagnosis |
| Plan | Treatment plan, prescriptions, follow-up instructions |

---

## The facts panel

After stopping a recording, you see the **facts panel** — all extracted facts grouped by category. Review them before saving.

If something is missing or incorrect:
- Minor errors are fine to leave — they won't affect document quality much
- Major errors (wrong medication dose, wrong weight) are worth noting in your provider notes
- You can add a second recording to clarify or correct anything

---

## Facts across multiple recordings

If you have more than one recording, facts from all recordings are combined for document generation. [PRODUCT_NAME] also runs **fact reconciliation** to identify any conflicts between recordings.

For example, if Recording 1 says weight is 32kg and Recording 2 says 34kg, reconciliation flags this as a contradiction for you to resolve.

See [Multi-Recording & Follow-Ups](/docs/multi-recording) for details.

---

## Provider notes vs facts

Facts come from your recording. **Provider notes** are what you type directly — specifically your **diagnosis** and **treatment plan**. These are added to the encounter detail page after saving.

Provider notes are combined with your recording facts when generating documents. The diagnosis you type goes into the Assessment section of the SOAP note; the treatment plan goes into the Plan section.

---

## Why facts matter for document quality

[PRODUCT_NAME]'s document generation works best when:
- The facts are complete (full history + exam + plan in one or more recordings)
- Provider notes include a clear diagnosis
- The patient demographics (age, sex, weight) are present

The more facts, the more detailed and accurate the generated documents will be.
`,
  },
  {
    slug: 'multi-recording',
    title: 'Multi-Recording & Follow-Ups',
    description: 'Adding multiple recordings to one encounter and how fact reconciliation works.',
    category: 'encounters',
    readTime: 4,
    content: `# Multi-Recording & Follow-Ups

A single encounter can have multiple recordings. This is useful for capturing different clinical events — a pre-encounter history, an examination, a post-procedure note, or a follow-up call — all tied to the same patient record.

---

## Adding a second recording

1. On the encounter detail page, click **Add Recording**
2. You're taken to the recording page with the same encounter loaded
3. Record your additional notes and save
4. The detail page now shows both recordings in the **Facts** tab

Each recording is stored separately, labelled by phase (History, Exam, Assessment, Follow-up) and order.

---

## When to use multiple recordings

**Scenario 1: History then exam**
Record the history and presenting complaint while taking the call or at check-in, then add a second recording after the physical examination.

**Scenario 2: Pre- and post-procedure**
Record your pre-surgical assessment, then add a post-procedure recording summarising what was done, any complications, and discharge instructions.

**Scenario 3: Follow-up call**
Add a recording the next day when the patient calls with an update. This keeps everything in one encounter record.

**Scenario 4: Updated findings**
Lab results come back after the encounter. Record your interpretation and amended plan as a follow-up recording.

---

## Fact reconciliation

When you have two or more recordings, [PRODUCT_NAME] automatically compares the facts and looks for **conflicts** — cases where the same clinical data appears with different values.

After adding a second recording, you'll see a brief analysis run ("Analysing fact relationships across recordings..."). Facts are then labelled with coloured indicators:

| Colour | Meaning |
|--------|---------|
| Green | Confirmed — same fact in both recordings |
| Blue | Updated — value changed (e.g. weight recorded differently) |
| Red | Contradiction — incompatible values that need resolving |
| Purple | New — fact only appears in the later recording |
| Grey | Unchanged — not mentioned in the newer recording |

---

## Resolving contradictions

Red facts are contradictions. [PRODUCT_NAME] shows you the value from each recording and asks you to choose:

- **Accept New** — use the value from the more recent recording
- **Keep Old** — keep the original value

Once resolved, the contradiction is marked with a checkmark. When documents are generated, the resolved value is used.

---

## Documents use all recordings

When you generate a document, [PRODUCT_NAME] combines facts from all recordings into the context. You don't need to do anything special — all your recordings contribute automatically.

If there are unresolved contradictions, [PRODUCT_NAME] will use the newer value by default. It's worth resolving them for accuracy.

---

## Phases

You can tag each recording with a clinical phase:

- **History** — initial complaint and background
- **Exam** — physical examination findings
- **Assessment** — working diagnosis and differential
- **Follow-up** — post-encounter or next-day update

Phases are optional but help keep multiple recordings organised, especially for longer cases.
`,
  },
  {
    slug: 'generating-documents',
    title: 'Generating Clinical Documents',
    description: 'How to generate all 7 document types, add provider notes, and edit documents inline.',
    category: 'encounters',
    readTime: 5,
    content: `# Generating Clinical Documents

Document generation is the main output of a encounter. From your recordings and provider notes, [PRODUCT_NAME] generates professional clinical documents in seconds.

---

## Before you generate

You need:
1. At least one **recording** saved to the encounter
2. A **diagnosis** entered in the Provider Notes section (strongly recommended)

The more complete your recording — history, exam findings, assessment, plan — the better the documents.

---

## Adding provider notes

On the encounter detail page, find the **Provider Notes** section in the workflow panel:

- **Diagnosis** — your working diagnosis or final diagnosis (e.g. "Acute gastroenteritis, dietary indiscretion")
- **Treatment Plan** — what you're prescribing and doing (e.g. "Maropitant 2mg/kg SQ SID x3 days, bland diet, recheck if no improvement in 48h")

These notes are included in every document you generate. The diagnosis flows into the Assessment section of the SOAP note; the treatment plan flows into the Plan section.

---

## Selecting document types

In the **Workflow Panel**, click the document type chips to select which documents you want:

| Chip | Document |
|------|---------|
| SOAP Note | Full structured clinical note |
| After-Visit Summary | Plain-language record for the client file |
| Discharge Instructions | Step-by-step care instructions for the patient to take home |
| Prescription | Drug details formatted for the pharmacy |
| Follow-Up Plan | Return visit schedule and monitoring instructions |
| Lab Order | Diagnostic tests ordered |
| Referral Letter | Clinical letter for a specialist |
| Shift Handoff | Clinical handoff summary for shift change |

You can generate one document at a time or all of them at once.

---

## Generating

1. Select the document types you want
2. Ensure your provider notes (diagnosis, treatment plan) are filled in
3. Click **Generate Documents**
4. Each document generates in parallel — you'll see progress indicators
5. Documents appear in the **Documents** tab as they complete

SOAP notes typically take 5–8 seconds. All 7 together usually complete within 15–20 seconds.

---

## Reading your documents

Click any document in the Documents tab to read it. Documents are formatted with clear headings and sections.

**SOAP Note sections:**
- Subjective — history, presenting complaint, patient observations
- Objective — physical examination findings, vitals, lab results
- Assessment — diagnosis, differentials, clinical reasoning
- Plan — treatment, prescriptions, follow-up, monitoring

---

## Editing documents

Everything is editable. Click into any section of a document and type — changes autosave immediately.

Common edits:
- Correct a medication dosage
- Add a clinical detail that wasn't in the recording
- Adjust the tone of the client-facing documents

---

## Regenerating

If you update your provider notes (e.g. revise the diagnosis after a lab result comes back), you can regenerate any document. Click **Regenerate** on the document — it uses your current provider notes and all your recordings to produce a fresh version.

Prior version is replaced. If you want to keep both, copy the text before regenerating.

---

## Documents are autosaved

Documents are automatically saved to the encounter record. Reload the page and they'll still be there. You don't need to export or save manually.
`,
  },
  {
    slug: 'evidence-files',
    title: 'Uploading Evidence Files',
    description: 'How to attach lab results, imaging, and referral letters to a encounter.',
    category: 'encounters',
    readTime: 3,
    content: `# Uploading Evidence Files

You can attach external files to any encounter — lab result PDFs, radiograph images, referral letters, or any other clinical document. These feed into your document generation as additional context.

---

## Supported file types

- PDF (lab results, referral letters, reports)
- Images (JPEG, PNG — for radiographs, photos)
- Most document formats are accepted

---

## Uploading a file

1. On the encounter detail page, find the **Evidence Files** panel
2. Drag and drop a file onto the panel, or click to browse
3. The file uploads and appears in the evidence list

[PRODUCT_NAME] auto-guesses the category based on the filename:
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

You can change the category by clicking the dropdown next to the file.

---

## Adding notes to a file

Click the notes field next to any uploaded file to add your interpretation:

> "External radiograph — no fracture of distal radius. Mild soft tissue swelling. No periosteal reaction."

These notes are treated as clinical facts and included in your document generation. They're the most important part — even if the AI can't read the PDF contents directly, your note about what the file shows is used.

---

## How evidence feeds into documents

When you generate documents, your evidence file notes are added as additional clinical context alongside your recording facts. For example, if you've noted "radiograph confirms no fracture, mild soft tissue swelling", this finding will appear in the Objective section of your SOAP note and inform the Assessment and discharge instructions.

---

## Viewing evidence files

All uploaded files appear in the Evidence tab of the encounter. Click any file to view it in the browser (PDF) or as an image.

Files are stored securely in the cloud and attached permanently to the encounter record.
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
- Start a chat **linked to a encounter** (the AI knows all the clinical facts from your recording)

To link a encounter, open a saved encounter and look for the Case Reasoning section on the detail page, or navigate to Case Reasoning and select the encounter from the dropdown.

---

## What you can ask

**Differential diagnoses**
> "What are the top differentials for a 58-year-old male with acute knee pain, no fracture on X-ray, and tenderness over the medial joint line?"

**Diagnostic plans**
> "What tests would you run first for a patient with new-onset polyuria and polydipsia?"

**Drug interactions**
> "Are there any interactions between metformin and lisinopril?"

**Drug doses**
> "What's the appropriate metoprolol dose for a 72kg patient with rate-controlled AFib?"

**Clinical reasoning**
> "We found elevated ALT and AST but normal bilirubin in a 45-year-old male with fatigue. What does that suggest?"

**Literature questions**
> "Is there evidence for early mobilisation in ICU patients on mechanical ventilation?"

---

## Starter prompts

When a encounter is linked, you'll see suggested prompts at the bottom:

- **Top differentials** — generates ranked differentials with confirmatory tests
- **Drug interactions** — checks all current medications for interactions
- **Diagnostic plan** — recommends prioritised tests based on the presentation
- **Summarise findings** — concise summary of the clinical picture

Click any of these to send them instantly.

---

## Multi-turn conversations

You can ask follow-up questions — the AI remembers the context of the conversation:

> You: "What are the differentials for this patient's knee pain?"
> AI: *[lists differentials]*
> You: "If it is a meniscal tear, what's the typical recovery time?"
> AI: *[answers in context of the previous response]*

Conversations are saved automatically and can be resumed later from the session list in the sidebar.

---

## Response time

Expect 10–15 seconds for a response. The AI is doing genuine clinical reasoning — not just keyword matching. The loading message updates every few seconds to let you know it's still working.

---

## Important notes

- **The AI doesn't replace your clinical judgment.** It provides information and reasoning to support your decision-making.
- **Always verify drug doses** against your preferred reference (Plumb's, BSAVA formulary) for the final prescription.
- **The AI knows about this encounter's facts.** If you ask about the patient's weight for a dose calculation, it uses the weight from your recording.
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

Imagine the patient gets home and wonders: *"What was that medication called again? Can I give her food tonight? What warning signs should I watch for?"*

Instead of calling the clinic, they open the link and ask the AI directly. It answers accurately from the encounter data — dosages, instructions, warning signs, follow-up dates — everything the provider recorded.

---

## Creating a companion link

1. Complete the encounter and generate at least a SOAP note or discharge instructions
2. Click **Publish** to finalise the encounter
3. Click **Share with Patient** — a unique link is generated
4. Copy and share the link however you like: SMS, email, WhatsApp, print it on the discharge sheet

---

## What the patient sees

The companion page shows:
- Your clinic name and the patient's details
- A welcome message summarising the visit in plain language
- Suggested questions to get them started ("What medication was prescribed?", "When is the follow-up?")
- A chat box for their own questions

---

## What the AI knows

The AI has access to everything in the encounter:
- Diagnosis and treatment plan
- Medication names, doses, frequency, duration, and instructions
- Home care instructions and activity restrictions
- Follow-up date and reason
- Dietary instructions
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

If the patient asks something outside the encounter, the AI says it doesn't have that information and directs them to call the clinic.

---

## Link management

- Companion links are **active** after publishing and until deactivated
- You can deactivate a link from the encounter detail page
- The link expires after a set period (set by your organisation's settings)

---

## Privacy

The companion link is a long, randomly generated token — it cannot be guessed. Only people you share the link with can access it. It contains no login credentials and no personally identifiable URL patterns.

---

## Updating the companion

If you need to add information after publishing (e.g. lab results come back), add an addendum to the encounter. The companion AI is automatically updated to include the new information.
`,
  },
  {
    slug: 'billing',
    title: 'Billing & Invoices',
    description: 'Setting up your billing catalog, reviewing extracted items, and generating invoices.',
    category: 'billing',
    readTime: 5,
    content: `# Billing & Invoices

[PRODUCT_NAME] automatically extracts billable items from your encounter recordings and matches them to your price list. After each encounter, you review the extracted items, add anything that was missed, and generate a formatted invoice.

---

## Setting up your billing catalog

Before the billing feature is useful, you need to add your services to the billing catalog.

Navigate to **Billing → Catalog** and add your items:

- **Name** — the service name (e.g. "Physical Examination", "CBC Panel")
- **Code** — your internal code (e.g. "EXAM-001", "LAB-CBC")
- **Category** — Exam, Procedure, Lab, Medication, Supply, Imaging, Hospitalization, or Other
- **Price** — base price in your currency
- **Taxable** — whether tax applies to this item

You can add items manually or import from a CSV file.

---

## How billing extraction works

When you save a encounter recording, [PRODUCT_NAME] automatically analyses the clinical facts and matches them to your catalog items. This runs in the background — you don't need to do anything.

For example, if your recording says:
> "I performed a full physical examination and drew blood for a CBC and chemistry panel..."

[PRODUCT_NAME] matches:
- Physical Examination → your catalog item
- CBC Panel → your catalog item
- Chemistry Panel → your catalog item

These appear in the **Billing** section of the encounter detail page, labelled as **Planned Services**.

---

## Two-phase billing

[PRODUCT_NAME] tracks billing items across the entire encounter:

**Phase 1 — Prospective (planned):** Items mentioned during the encounter as things you're going to do. *"I'm going to run a CBC... we'll need to do a dental cleaning..."*

**Phase 2 — Retrospective (completed):** Items mentioned in a post-encounter recording as things you actually did. *"I completed the dental cleaning... extracted two teeth... prescribed amoxicillin..."*

The system compares what was planned against what was done. If anything was done but not planned (common with dental extractions, additional medications, or emergency add-ons), it flags those as **Missed Items** — revenue you would have otherwise lost.

---

## Reviewing billing items

On the encounter detail page, open the **Billing** section:

- **Confirmed items** — planned and completed, green tick
- **Missed items** — done but not originally planned, highlighted in amber — these are the money savers
- **Cancelled items** — planned but not done, shown but excluded from the invoice

For each missed item, you can:
- **Add to invoice** — include it
- **Dismiss** — exclude it (if it was genuinely not billable)

---

## Adjusting items

Before generating the invoice, you can:
- Edit quantities (e.g. "Tooth Extraction x2")
- Override the price for a specific item
- Add items manually from your catalog

---

## Generating an invoice

Once you've reviewed the items, click **Generate Invoice**. [PRODUCT_NAME] creates a formatted invoice document showing:

- Itemised charges with codes, quantities, and prices
- Subtotal, tax (if configured), and total
- Revenue recovery summary: "You almost missed $145 in charges"

The invoice is saved to the encounter and can be printed or exported as a PDF.

---

## Tax settings

Configure your tax settings at **Settings → Billing**:

- **Tax rate** — your VAT, GST, or sales tax rate
- **Tax name** — what to call it on invoices ("VAT", "GST", "Sales Tax")
- **Tax mode:**
  - *Tax-exclusive* (US, Canada) — tax is added on top of prices
  - *Tax-inclusive* (UK, EU, Australia) — prices already include tax, tax shown as a breakdown
`,
  },
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
- **Emergency phone** — shown to owners in the companion app
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
| Practice Admin | Location-scoped access — can only see patients/encounters at assigned locations |

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

The team page shows how many seats you've used.

---

## Locations

**Settings → Locations** (Multi-Location plan)

If you have multiple clinic locations, each can have its own name, address, and phone number. Patients and encounters can be assigned to a specific location.

Practice Admin members can be scoped to specific locations — they only see patients and encounters at their assigned clinic.

---

## Billing & subscription

**Settings → Billing**

- View your current plan and billing status
- See how many encounters you've used this billing period
- Upgrade or downgrade your plan
- Manage your payment method, view invoices → **Manage Subscription** opens the Stripe billing portal

### Plans

| Plan | Price | Best for |
|------|-------|---------|
| Solo | $79/month | Single provider practice |
| Practice | $149/month | Small multi-provider clinic |
| Multi-Location | $299/month | Multiple clinic locations |

All plans include a 14-day free trial when you sign up.

---

## Dark mode

Click the **dark mode toggle** in Settings to switch between light and dark themes. Your preference is saved across sessions.

---

## Getting help

If you run into a problem or have a question not covered here, use the **⌘K Ask AI** feature to ask in plain English — or contact support from the Settings page.
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
