# Human Health Fork — Master Plan
> Forking Lamina (lamina.vet) into a hospital-grade AI clinical workflow platform
> Target: Emergency medicine & hospitalist physicians, staffing groups
> Status: Planning — 2026-03-29

---

## North Star

Build the ambient AI platform that goes beyond the SOAP note. Every competitor stops at "record → transcribe → note → push to Epic." We go further: **record → transcribe → full visit workflow → patient companion → shift handoff → billing codes**. That full lifecycle is the moat.

---

## Overarching Phases

| Phase | Name | Owner | Gate |
|-------|------|-------|------|
| 0 | Decisions | YOU | Name + niche confirmed |
| 1 | New Infrastructure | YOU | All API keys in hand |
| 2 | HIPAA Foundation | YOU (+ Claude for audit log code) | BAAs signed |
| 3 | Repo Fork & Config | YOU → CLAUDE | New repo live, envs wired |
| 4 | Terminology & Branding | CLAUDE | Zero vet references remain |
| 5 | Schema Migration | CLAUDE | Schema pushed to new Convex |
| 6 | Corti Agent Prompts | CLAUDE | All prompts updated for human medicine |
| 7 | Document Types | CLAUDE | All 7 doc types updated |
| 8 | Epic FHIR Integration | CLAUDE + YOU | Notes push into Epic |
| 9 | Human-Specific Features | CLAUDE | Shift handoff, ICD-10, patient SMS |
| 10 | Pricing & Stripe | YOU → CLAUDE | New tiers live |
| 11 | QA Pass | CLAUDE | Full workflow tested |
| 12 | Go-to-Market | YOU | 3+ beta physicians signed |

---

## Phase 0 — Decisions
> Owner: **YOU** | Do this first, everything depends on it

- [ ] **Product name** — needs to be clinical-feeling, not cutesy. Think: Vela, Ardent, Sienna, Loom, Opus, Meridian. Avoid anything with "AI" or "Doc" in the name.
- [ ] **Domain** — register once name is decided. `.com` strongly preferred for enterprise trust.
- [ ] **Target specialty** — recommendation: Emergency Medicine first, then Hospitalist. Lock this in — it shapes all the Corti prompts and the sales story.
- [ ] **HIPAA launch stance** — two options:
  - **(A) Beta/research only** — launch without full HIPAA compliance, explicitly labeled "research use only / no PHI." Gets you in front of physicians fast. Flip to full HIPAA at first real contract.
  - **(B) HIPAA-first** — get BAAs signed before any physician data touches the system. Slower but cleaner. Required for any hospital pilot.
  - **Recommendation: (A)** — move fast, find your champions, get BAAs in place before you go live with a hospital.
- [ ] **SOC 2 decision** — hospitals will eventually ask. Start the process early (6 months). Use Vanta or Drata to automate — ~$10K/year but saves 100+ hours.

---

## Phase 1 — New Infrastructure
> Owner: **YOU** | Run in parallel with Phase 0

### 1a. GitHub
- [ ] Create new private repo (e.g., `your-org/product-name`)
- [ ] Copy Lamina codebase in (do NOT fork — you want a clean history)
  ```bash
  # In a fresh directory:
  git clone git@github.com:your-org/lamina.git product-name
  cd product-name
  git remote remove origin
  git remote add origin git@github.com:your-org/product-name.git
  git push -u origin main
  ```

### 1b. Convex
- [ ] Go to convex.dev → New Project
- [ ] Name it after the product
- [ ] Run `npx convex dev` in the new repo — this links the project and generates `CONVEX_DEPLOYMENT` + `NEXT_PUBLIC_CONVEX_URL`
- [ ] Save both values for Phase 3

### 1c. Clerk
- [ ] Go to clerk.com → Create Application
- [ ] Enable **Organizations** feature (required for multi-org)
- [ ] Configure JWT template if needed (check existing Lamina Clerk config)
- [ ] Grab: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- [ ] Set allowed redirect URLs to new domain
- [ ] **BAA note**: Clerk BAA requires contacting their enterprise team. Do this early.

### 1d. Stripe
- [ ] Create new Stripe account (or new product in existing account)
- [ ] Create 3 products:
  - Solo Provider — $99/mo (adjusted from $79 for human health market)
  - Practice — $199/mo
  - Enterprise / Hospital Group — custom / contact
- [ ] Create prices for each, grab price IDs
- [ ] Set up webhook endpoint (do after Vercel deploy in Phase 3): `https://yourdomain.com/api/stripe/webhook`
- [ ] Grab: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] All 3 price IDs: `STRIPE_SOLO_PRICE_ID`, `STRIPE_PRACTICE_PRICE_ID`

### 1e. Vercel
- [ ] New project → import from new GitHub repo
- [ ] Set framework to Next.js
- [ ] Leave env vars empty for now (Phase 3)
- [ ] Note your Vercel project URL (e.g., `product-name.vercel.app`)

### 1f. Domain
- [ ] Register domain (Namecheap, Cloudflare, etc.)
- [ ] Point nameservers to Vercel (or add CNAME in Vercel dashboard)
- [ ] Enable HTTPS (automatic with Vercel)

---

## Phase 2 — HIPAA Foundation
> Owner: **YOU** (legal/vendor work) + **CLAUDE** (audit log implementation)
> Run this in parallel with Phases 3-7

### 2a. Vendor BAAs — YOU
Contact each vendor and request a Business Associate Agreement. Most have self-serve options:

| Vendor | BAA Path | Notes |
|--------|----------|-------|
| **Convex** | Pro plan required → Settings → HIPAA | ~$25/mo Pro |
| **Clerk** | Enterprise contact required | Email enterprise@clerk.com |
| **Stripe** | Automatic on Business accounts | Settings → Data Privacy |
| **Corti** | Contact your Corti account rep | They serve human health, should have one ready |
| **Vercel** | Pro plan → Settings → Legal → BAA | ~$20/mo Pro |

### 2b. Legal Docs — YOU
- [ ] Draft HIPAA-compliant Privacy Policy (use a healthcare attorney or Termly/iubenda healthcare template)
- [ ] Draft Terms of Service with HIPAA addendum
- [ ] Draft your own BAA template for when hospitals ask you to sign one as their Business Associate

### 2c. Audit Logging — CLAUDE
Once schema is migrated (Phase 5), Claude will implement:
- PHI access logging (who accessed which patient record, when)
- Login/logout events
- Document generation events
- Data export events
- Stored in `auditLogs` Convex table (scoped by org + userId)

### 2d. SOC 2 Kickoff — YOU (optional but recommended)
- [ ] Sign up for Vanta ($800/mo) or Drata ($1000/mo) — they automate most of the evidence collection
- [ ] Costs ~$10K/year but reduces the SOC 2 process from 200 hours to ~40 hours

---

## Phase 3 — Repo Fork & Config
> Owner: **YOU** hands keys to **CLAUDE**

### 3a. YOU: Gather all env vars from Phase 1 and provide them
The new `.env.local` will need:
```
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SOLO_PRICE_ID=
STRIPE_PRACTICE_PRICE_ID=

# Corti (same keys as Lamina if using same Corti account)
CORTI_API_KEY=
CORTI_API_URL=

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 3b. CLAUDE: Config file updates
- `package.json` — name, description
- `next.config.ts` — domain references, CSP headers
- `src/lib/superadmin.ts` — update superadmin email list
- Any hardcoded `lamina.vet` or `VetAI` or `Lamina` strings in config/meta files

---

## Phase 4 — Terminology & Branding Pass
> Owner: **CLAUDE** | ~2-3 hours of work

Full systematic rename across the entire codebase. Key mappings:

### Core terminology
| From | To | Notes |
|------|----|-------|
| `vet` / `veterinarian` | `provider` / `physician` | context-dependent |
| `vets` (table) | `providers` | Convex table rename |
| `vetId` | `providerId` | all schema fields + queries |
| `pet owner` | `patient` | the human patient |
| `owner` (in companion context) | `patient` | |
| `pet` / `animal` | `patient` | |
| `species` / `breed` | removed | see Phase 5 |
| `consultation` | `encounter` or `visit` | pick one, use consistently |
| `Owner Companion` | `Patient Companion` | |
| `Practice` (org type) | `Practice` | same, no change |
| `client` (in clientSummary) | `patient` | |
| `Lamina` | [product name] | |
| `lamina.vet` | [new domain] | |

### Role labels
| From | To |
|------|----|
| `role: 'vet'` | `role: 'provider'` |
| `maxVetSeats` | `maxProviderSeats` |
| `vet-fact-reconciler` (Corti agent) | `clinical-fact-reconciler` |

### UI copy targets
- Onboarding: "Add your first patient" not "Add your first pet"
- Dashboard: "Today's Encounters" not "Today's Consultations"
- Settings: "Providers" not "Vets"
- Billing: CPT/ICD-10 language not procedure-specific vet language

---

## Phase 5 — Schema Migration
> Owner: **CLAUDE** | Requires Convex dev environment from Phase 1

### 5a. patients table — remove vet-specific fields, add human fields

**Remove:**
- `species` (required in vet, doesn't exist in human)
- `breed`
- `weight` / `weightUnit` (moves to physical exam)
- `vaccinations` array

**Keep / rename:**
- `name` → keep
- `dateOfBirth` → keep
- `sex` → keep
- `ownerName/ownerEmail/ownerPhone` → rename to `emergencyContact` object
- `medicalHistory` → keep (maps perfectly)
- `labResults` → keep

**Add:**
- `mrn` (Medical Record Number) — optional string
- `dateOfBirth` — already exists, good
- `insurance` — optional object `{ provider, memberId, groupId }`
- `allergies` — array of strings
- `immunizations` — replaces vaccinations, same shape
- `primaryCareProvider` — optional string

### 5b. providers table (rename from vets)
- `specialties` → keep (EM, IM, etc.)
- `license` → keep (medical license #)
- `npi` → add (National Provider Identifier — critical for billing)
- `dea` → add (DEA number for prescriptions)
- Remove any vet-specific fields

### 5c. organizations table
- `maxVetSeats` → `maxProviderSeats`
- `clinicName` / `clinicPhone` etc → keep, rename to `practiceName` etc
- `emergencyPhone` → keep

### 5d. consultations table
- Remove `extractedPatientInfo.species` / `breed`
- Remove `diagnosisResult.signalment` (species/breed/breedPredispositions — all vet-specific)
- Remove `caseReasoning.drugInteractions.result.medications[].speciesContraindications`
- Add `encounterType` — `'ed' | 'inpatient' | 'outpatient' | 'telehealth'`
- Add `chiefComplaint` (rename from `reasonForVisit` — same concept, better clinical term)
- Add `icd10Codes` — array of strings (extracted/suggested)
- Add `cptCodes` — array of strings (for billing)
- Add `admissionStatus` — `'ambulatory' | 'admitted' | 'transferred' | 'discharged'`

### 5e. companionSessions table
- Remove `context.species`, `context.breed`
- Rename `context.visitSummary` → keep
- Add `context.icd10Codes` for patient-facing diagnosis explanation

### 5f. generatedDocuments — add new types
- `clientSummary` → rename to `afterVisitSummary`
- `labRequest` → rename to `labOrder`
- Add `shiftHandoff` — new document type (SBAR format)
- Add `admissionOrder` — future

### 5g. New: auditLogs table (HIPAA)
```
auditLogs: {
  orgId, userId, action, resourceType, resourceId,
  ipAddress, userAgent, timestamp
}
```

---

## Phase 6 — Corti Agent Prompts
> Owner: **CLAUDE**

All agent system prompts live in `src/services/corti-agents.ts` and the individual API routes. Full rewrite of clinical context.

### 6a. Fact extraction prompt
Change from veterinary clinical language to human medicine:
- Remove species/breed context
- Add: "The patient is a human. Extract clinically relevant facts in standard medical terminology."
- Add ICD-10 awareness: flag facts that suggest billable diagnoses

### 6b. Document generation (SOAP note)
The `corti-soap` template key may need to change — check with Corti if they have a human medicine SOAP template vs the vet one. The sections (Subjective, Objective, Assessment, Plan) are the same structure, just the clinical content differs.

- Update `clientSummary` template → `corti-patient-summary` (verify with Corti this is human-medicine appropriate)
- Add instructions for human anatomy, drug names, dosing in human ranges

### 6c. Case reasoning / differential diagnosis
Major rewrite:
- Remove all veterinary differential logic
- Human differentials: use standard medical differential structure
- Add: likelihood ratios, Bayesian reasoning for common ED presentations
- Drug interactions: remove `speciesContraindications`, add human-specific contraindications
- Dosing: human weight-based dosing (mg/kg for peds, standard adult doses)

### 6d. Billing extraction (`getVeterinaryOrchestrator` → `getClinicalOrchestrator`)
- Remove vet procedure codes
- Extract CPT codes (procedure codes)
- Extract ICD-10 codes (diagnosis codes)
- Match against billing catalog (which will contain CPT codes)
- Add E&M level suggestion (99213, 99214, 99215 — the bread and butter of physician billing)

### 6e. Shift handoff agent (new)
New Corti agent: `clinical-handoff-generator`
- Input: consultation facts + current patient status
- Output: SBAR format (Situation, Background, Assessment, Recommendation)
- Critical for ED and hospitalist workflow — this is a genuine pain point

### 6f. Patient companion prompt
- Remove "pet owner" framing
- Add: patient is a human adult (or caregiver for pediatric)
- Adjust medication explanation style
- Add: "You can suggest the patient follow up with their primary care provider"

---

## Phase 7 — Document Types
> Owner: **CLAUDE**

### Updated document type mapping

| DB Key | Display Name | Template | Notes |
|--------|-------------|----------|-------|
| `soapNote` | SOAP Note | `corti-soap` | Unchanged structure |
| `afterVisitSummary` | After Visit Summary | `corti-patient-summary` | Renamed from clientSummary |
| `dischargeInstructions` | Discharge Instructions | custom agent | Unchanged |
| `prescription` | Prescription / Medication Order | custom agent | Add DEA# field |
| `followUpPlan` | Follow-Up Plan | custom agent | Unchanged |
| `labOrder` | Lab Order | custom agent | Renamed from labRequest |
| `referralLetter` | Referral Letter | custom agent | Unchanged |
| `shiftHandoff` | Shift Handoff (SBAR) | new agent | **New — major differentiator** |

### Billing catalog changes
- Replace vet procedure categories with CPT categories:
  - `'em'` (Evaluation & Management — the most common)
  - `'procedure'`
  - `'lab'`
  - `'imaging'`
  - `'critical-care'`
  - `'observation'`
- Category `'medication'` → keep, but dosing/pricing structure changes

---

## Phase 8 — Epic FHIR Integration
> Owner: **CLAUDE** (code) + **YOU** (Epic registration)
> This is the most complex phase — plan 2-4 weeks

### 8a. Epic App Orchard Registration — YOU
1. Go to **fhir.epic.com** → Register as a developer (free)
2. Create a new app in the Epic App Market
3. Request FHIR scopes needed:
   - `patient/Patient.read` — read patient demographics
   - `user/DocumentReference.write` — push clinical notes
   - `user/Encounter.read` — read encounter context
   - `launch/patient` — SMART launch with patient in context
4. Epic will give you a **Client ID** for non-production (sandbox) and eventually production
5. Production access requires Epic to approve your app — plan 1-3 months, requires security review
6. **Sandbox is available immediately** — use `open.epic.com` for development

### 8b. SMART on FHIR OAuth — CLAUDE
Implement the SMART app launch sequence:
```
EHR (Epic) launches your app URL with ?launch=xxx&iss=https://epic-fhir-server/
  → App exchanges launch token for access token (OAuth 2.0 PKCE)
  → App uses access token to call Epic FHIR APIs
  → App pushes DocumentReference back to Epic
```

Files to create:
- `src/app/api/fhir/launch/route.ts` — SMART launch handler
- `src/app/api/fhir/callback/route.ts` — OAuth callback
- `src/services/fhir-client.ts` — FHIR API wrapper (use `fhirclient` npm package)
- `src/app/fhir-launch/page.tsx` — launch context page

### 8c. Note Push to Epic — CLAUDE
After generating a SOAP note, add "Push to Epic" button:
- Creates a `DocumentReference` FHIR resource
- Attaches the note as base64-encoded text/plain or text/html
- Links to the patient and encounter via FHIR references
- Returns confirmation with Epic document ID

```typescript
// Rough shape of the FHIR DocumentReference payload
{
  resourceType: "DocumentReference",
  status: "current",
  type: { coding: [{ system: "http://loinc.org", code: "11488-4", display: "Consultation note" }] },
  subject: { reference: `Patient/${epicPatientId}` },
  context: { encounter: [{ reference: `Encounter/${epicEncounterId}` }] },
  content: [{ attachment: { contentType: "text/plain", data: base64Note } }]
}
```

### 8d. Patient Demographics Pull — CLAUDE
When a physician starts a new encounter, optionally pull patient demographics from Epic:
- Name, DOB, sex, MRN, allergies, problem list, current medications
- Pre-populate the patient record to reduce manual entry
- Critical for ED workflow where physicians see patients they've never met

### 8e. Non-Epic EHR fallback
Not all hospitals use Epic. Add a simple "Export Note" flow for others:
- Copy to clipboard (formatted)
- Download as PDF
- Download as DOCX
- This covers Cerner, Meditech, Athena users in the short term

---

## Phase 9 — Human-Specific Features
> Owner: **CLAUDE**

### 9a. Shift Handoff (SBAR) — highest priority new feature
- New document type in the workflow panel
- Input: current facts + patient status + any pending orders
- Output: SBAR note ready to hand off to incoming physician
- One-click generation from the encounter detail page
- For ED: "sign out" button at end of shift generates handoff notes for all active patients

### 9b. ICD-10 Suggestion
- After facts are extracted, run a lightweight Corti call to suggest ICD-10 codes
- Display as chips the provider can accept/reject
- Accepted codes stored in `consultations.icd10Codes`
- Flow into billing catalog matching

### 9c. CPT Code Billing
- Rename billing catalog categories to CPT categories
- Add E&M level suggester: based on documented complexity, suggest 99213/99214/99215
- This is where you can genuinely recover revenue for practices

### 9d. Patient Companion — SMS delivery
- After discharge, physician clicks "Send to Patient"
- Patient receives SMS with a link to their companion session
- No app download required — web-based
- Add Twilio integration: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- This is the feature that will make physicians' jaws drop — no competitor does this

### 9e. Multi-speaker audio
- Flag for future: ED encounters often have attending + resident + patient + family
- Corti may handle multi-speaker natively — confirm with them
- At minimum: label transcript segments by speaker role

---

## Phase 10 — Pricing & Stripe
> Owner: **YOU** creates Stripe products, **CLAUDE** wires price IDs

### Recommended pricing (adjusted for physician market)

| Tier | Price | Seats | Target |
|------|-------|-------|--------|
| Solo Provider | $149/mo | 1 | Independent physician, NP, PA |
| Practice | $299/mo | up to 5 | Small group practice |
| Group / Staffing | Custom | unlimited | EmCare, TeamHealth, etc. |

Notes:
- Nuance DAX is $350+/provider/month — you can undercut significantly
- The staffing group tier is where the real money is — sell to the group, deploy to all physicians
- Consider annual pricing at 2 months free

### What CLAUDE will update
- Price IDs in `src/lib/stripe.ts` and plan config
- Tier names and seat limits in `src/lib/plans.ts` (or equivalent)
- Billing page copy

---

## Phase 11 — QA Pass
> Owner: **CLAUDE**

Full end-to-end walkthrough:
- [ ] New org signup → onboarding → first provider created
- [ ] New patient created (no species/breed fields present)
- [ ] New encounter → record audio → facts extracted
- [ ] Generate SOAP note → verify no vet language in output
- [ ] Generate After Visit Summary → verify patient-appropriate language
- [ ] Generate Shift Handoff (SBAR) → verify format
- [ ] Patient companion → verify species/breed references gone
- [ ] Billing flow → CPT extraction → invoice
- [ ] Epic FHIR sandbox → push note → verify receipt
- [ ] All env var references verified

---

## Phase 12 — Go-to-Market
> Owner: **YOU**

### Finding your beta physicians
- **DON'T** cold email random physicians — response rate near zero
- **DO** post in physician communities:
  - r/emergencymedicine (reddit) — very active, surprisingly receptive to tools
  - Doximity groups for EM/IM physicians
  - LinkedIn: search "Medical Director Emergency Medicine"
  - Twitter/X: the #MedTwitter community is vocal about EHR pain
- **Target**: physicians who already complain publicly about documentation burden

### The pitch to a physician champion
Not "AI for documentation." The pitch is:
> "You spend 2 hours after your shift finishing charts. I want to give you those 2 hours back.
> And when your patient leaves, they get a smart AI they can ask questions — reducing your
> callback volume. Free for your first 30 encounters."

### The pitch to a staffing group (EmCare, TeamHealth, Sound, Envision)
Not product — ROI:
> "Our platform reduces documentation time by 40% per encounter and increases E&M coding
> accuracy by capturing billable complexity that currently goes undocumented.
> At 20 encounters/shift across 50 physicians, that's X recovered per year."
> You need a few physician testimonials before this conversation.

### Conferences to target (once you have a product)
- ACEP (American College of Emergency Physicians) — October
- SHM (Society of Hospital Medicine) — spring
- These are where physicians actually buy tools

---

## Key Technical Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Epic App Orchard approval takes 3+ months | Build Epic-less workflow first; use PDF/clipboard export as fallback |
| Corti templates may differ between vet and human | Audit all template keys with Corti; most SOAP/summary templates are shared |
| HIPAA BAA delays launch | Use Option A (research/beta mode) until BAAs signed |
| Multi-speaker audio quality in noisy ED | Test Corti in noisy environment early; may need audio preprocessing |
| Physicians won't pay without Epic integration | Lead with the full workflow story — note + handoff + patient companion is the hook even without Epic |

---

## What Doesn't Change (Keep As-Is from Lamina)

- Multi-org architecture (perfect as-is)
- Clerk auth + Organizations
- Stripe billing infrastructure
- Onboarding flow (just update copy)
- Superadmin dashboard
- Fact reconciliation engine (domain-agnostic)
- Case reasoning architecture (just update prompts)
- Evidence file uploads
- Recording lifecycle (draft/in-progress/finalized)
- BillingGuard component
- The entire settings/team/billing UX

---

## Suggested Order of Attack

**Week 1 (You):** Phase 0 + Phase 1 — decisions, new repo, all accounts set up
**Week 1-2 (Claude):** Phase 4 + 5 — terminology pass + schema migration (can start once new repo exists)
**Week 2 (Claude):** Phase 6 + 7 — Corti prompts + document types
**Week 2-3 (Claude):** Phase 8a setup + Phase 9 (non-Epic features first)
**Week 3 (You):** Phase 2 — HIPAA vendor BAAs (run in background throughout)
**Week 3-4 (Claude):** Phase 8 — Epic FHIR integration
**Week 4 (Both):** Phase 10 + 11 — pricing wired, full QA pass
**Ongoing (You):** Phase 12 — physician outreach
