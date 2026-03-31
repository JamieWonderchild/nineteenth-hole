// Workflow Document Generation Service
// Uses Corti's v2 document generation API instead of chat agents.
// The provider diagnoses. This service handles documentation, patient communication,
// prescriptions, and follow-up planning.

import type {
  Fact,
  DocumentGenerationPayload,
  DocumentContext,
  SimplifiedFact,
  TemplateSection,
} from '@/types/corti';

import type {
  DocumentType,
  WorkflowRequest,
  WorkflowResponse,
  WorkflowAgentRole,
  WorkflowTraceEntry,
  GeneratedDocument,
  DocumentSection,
  PatientContext,
  PrescriptionItem,
  FollowUpSuggestion,
} from '@/types/workflow';

import { CortiClient, createCortiClientFromEnv } from '@/services/corti-client';

// ============================================================================
// DOCUMENT TYPE METADATA
// ============================================================================

const DOCUMENT_TYPE_INFO: Record<DocumentType, { title: string; description: string }> = {
  'soap-note': {
    title: 'SOAP Note',
    description: 'Standard clinical documentation (Subjective, Objective, Assessment, Plan)',
  },
  'after-visit-summary': {
    title: 'After-Visit Summary',
    description: 'Plain-language visit summary for the patient',
  },
  'discharge-instructions': {
    title: 'Discharge Instructions',
    description: 'Post-visit care instructions for the patient',
  },
  'referral-letter': {
    title: 'Referral Letter',
    description: 'Professional referral to a specialist physician',
  },
  'prescription': {
    title: 'Prescription',
    description: 'Medication prescriptions with dosing and instructions',
  },
  'lab-order': {
    title: 'Lab Order',
    description: 'Laboratory test order form',
  },
  'follow-up-plan': {
    title: 'Follow-Up Plan',
    description: 'Follow-up visit schedule and monitoring instructions',
  },
  'shift-handoff': {
    title: 'Shift Handoff',
    description: 'Clinical handoff summary for shift change',
  },
};

// ============================================================================
// TEMPLATE CONFIGURATION
// ============================================================================

interface TemplateConfig {
  templateKey?: string;
  sections?: TemplateSection[];
}

// Available Corti default section keys:
//   corti-subjective, corti-objective, corti-assessment, corti-plan
//   corti-patient-summary, corti-referral
// Available default template keys: corti-soap, corti-patient-summary, corti-referral
// Custom [PRODUCT_NAME] templates (created in Directus):
//   vetai-client-summary, vetai-discharge-instructions, vetai-prescription,
//   vetai-follow-up-plan, vetai-lab-request, vetai-referral-letter
const TEMPLATE_CONFIG: Record<DocumentType, TemplateConfig> = {
  'soap-note': {
    templateKey: 'corti-soap',
  },
  // After-Visit Summary: corti-* sections with patient-friendly overrides.
  // vetai-client-summary templateKey fails with "missing content" for routed_parallel mode.
  'after-visit-summary': {
    sections: [
      {
        key: 'corti-subjective',
        nameOverride: 'Visit Overview',
        contentOverride: 'Include: reason for visit, presenting complaint, relevant history, presenting complaint, relevant history. Exclude: detailed physical exam findings, lab values, technical medical terms.',
        writingStyleOverride: 'Warm, clear, plain language suitable for patients. Avoid medical jargon.',
        additionalInstructionsOverride: `Write a brief, friendly summary of why the patient came in today.
IMPORTANT: Use ONLY the facts provided. Do NOT invent or assume symptoms — state exactly what the facts say.
- The specific presenting complaint from the facts (e.g., "limping on right front leg" not "feeling under the weather")
- How long the issue has been going on, if mentioned in the facts
- Any relevant background or history from the facts

If the facts mention a specific complaint (lameness, vomiting, cough, etc.), use those exact terms in plain language. Do NOT generalize or soften the presenting complaint.
2-3 sentences. Use plain, clear language a patient would understand.`,
      },
      {
        key: 'corti-assessment',
        nameOverride: 'What We Found',
        contentOverride: 'Include: diagnosis or working diagnosis, key exam findings explained simply, test results in plain language. Exclude: raw lab values, differential lists, technical terminology.',
        writingStyleOverride: 'Reassuring, clear, plain language for patients',
        additionalInstructionsOverride: `Explain the findings and diagnosis in pet-owner-friendly language:
- What the provider found during the examination
- What the diagnosis or suspected condition is
- What this means for the patient in simple terms

Be honest but reassuring. Avoid medical jargon — translate findings into everyday language.`,
      },
      {
        key: 'corti-plan',
        nameOverride: 'Care Instructions',
        contentOverride: 'Include: medications with simple dosing instructions, home care tasks, dietary changes, activity restrictions, warning signs to watch for. Exclude: drug mechanisms, pharmacology details, differential diagnoses.',
        writingStyleOverride: 'Action-oriented, numbered steps, plain language',
        additionalInstructionsOverride: `Provide clear home care instructions the patient can follow:
- Medications: name, dose, how often, how to give, for how long
- Activity: any restrictions (rest, no jumping, leash walks only)
- Diet: any changes needed
- Warning signs: what to watch for that would need immediate medical attention
- Follow-up: when to come back

Use numbered steps. Be specific and practical.`,
      },
    ],
  },
  // Discharge Instructions: corti-* sections with detailed care overrides.
  // vetai-discharge-instructions templateKey fails with "missing content" for routed_parallel mode.
  'discharge-instructions': {
    sections: [
      {
        key: 'corti-assessment',
        nameOverride: 'Diagnosis & Prognosis',
        contentOverride: 'Include: primary diagnosis, secondary findings, prognosis, expected outcome. Exclude: differential diagnoses list, raw lab data, exam technique details.',
        writingStyleOverride: 'Clear clinical language, suitable for patient records',
        additionalInstructionsOverride: `State the diagnosis and prognosis clearly:
- Primary diagnosis
- Any secondary findings (e.g. known conditions like arthritis)
- Expected outcome / prognosis

Keep it concise — 2-3 sentences. This is for the patient's records.`,
      },
      {
        key: 'corti-plan',
        nameOverride: 'Treatment, Medications & Home Care',
        contentOverride: 'Include: all medications prescribed with dose and frequency, continued medications, exercise restrictions, activity modifications, dietary changes, home care instructions, recheck timing, warning signs to watch for. Exclude: drug interactions, pharmacokinetics, clinical reasoning.',
        writingStyleOverride: 'Structured list format with clear headings, action-oriented',
        additionalInstructionsOverride: `Provide comprehensive discharge instructions covering:

**Medications:**
- Each medication: name, dose, frequency, duration, special instructions
- Include both NEW and CONTINUED medications

**Activity & Home Care:**
- Exercise restrictions and duration
- Activity modifications (leash walks only, no jumping, etc.)
- Any dietary changes needed

**Follow-Up:**
- When to return for recheck
- What will be assessed at follow-up

**Warning Signs — Return Immediately If:**
- Signs that warrant earlier return or emergency visit
- Worsening symptoms to watch for

Use numbered steps and clear headings. Be specific and practical.`,
      },
      {
        key: 'corti-patient-summary',
        nameOverride: 'Patient Summary',
        contentOverride: 'Include: patient demographics, presenting complaint, relevant history, current condition overview. Exclude: medication details, treatment plan, follow-up scheduling.',
        writingStyleOverride: 'Brief clinical summary, 2-3 sentences',
        additionalInstructionsOverride: `Provide a brief patient summary for the discharge record:
- Patient name, age, sex, weight
- Reason for visit
- Key findings from this visit
Keep to 2-3 sentences.`,
      },
    ],
  },
  // Prescription: corti-* sections with Rx-specific overrides.
  // vetai-prescription templateKey fails with "missing content" for routed_parallel mode.
  'prescription': {
    sections: [
      {
        key: 'corti-plan',
        nameOverride: 'Medications Prescribed',
        contentOverride: 'Include: ALL medications mentioned in the facts — drug names, dosing instructions, how to give them, duration. Exclude: diagnosis details, exam findings, non-medication treatments.',
        writingStyleOverride: 'Clear, client-friendly prescription format',
        additionalInstructionsOverride: `Create a clean, readable prescription that patients can easily understand and follow.

For each medication mentioned in the facts, provide:

**[Medication Name]** (include form: tablets/liquid/topical if mentioned)
• How to give: [dose and route in plain language, e.g., "Give 1 tablet by mouth"]
• When: [frequency in plain language, e.g., "Twice daily (morning and evening)" or "Every 12 hours"]
• Duration: [how long, e.g., "For 7 days" or "Until finished"]
• Instructions: [any special notes, e.g., "Give with food" or "Can hide in treat"]

FORMATTING RULES:
- Use bold headers for medication names
- Use bullet points for details
- Skip any field not clearly stated in the facts
- Use plain language, not medical abbreviations (say "twice daily" not "BID")
- If the medication is a continuation of existing treatment, note "(Continue current medication)"
- Separate each medication with a blank line for readability

If no medications are mentioned, state "No medications prescribed at this visit."`,
      },
    ],
  },
  // Follow-Up Plan: corti-* sections with follow-up-specific overrides.
  // vetai-follow-up-plan templateKey fails with "missing content" for routed_parallel mode.
  'follow-up-plan': {
    sections: [
      {
        key: 'corti-plan',
        nameOverride: 'Follow-Up Recommendations',
        contentOverride: 'Include: recheck timing, monitoring instructions, expected progression, criteria for improvement or concern, when to return sooner, long-term management plan. Exclude: current examination findings, medication details, diagnosis reasoning.',
        writingStyleOverride: 'Structured timeline format, clear and actionable',
        additionalInstructionsOverride: `Create a follow-up care plan:
- Recheck appointment: when and what will be assessed
- Monitoring at home: what the patient should track (appetite, energy, symptoms)
- Expected timeline: when improvement should be seen
- Red flags: signs that warrant earlier return
- Long-term: ongoing management needs (chronic conditions, preventive care)
- Next steps: any pending test results, specialist referrals, or procedures

Use a timeline format when possible (e.g., "Day 3-5: expect...", "2 weeks: recheck...").`,
      },
    ],
  },
  // Referral Letter: corti-* default sections with provider-specific overrides.
  // The vetai-referral-letter Directus template exists but returns 500; these overrides produce excellent output.
  'referral-letter': {
    sections: [
      {
        key: 'corti-referral',
        nameOverride: 'Referral Information',
        contentOverride: 'Include: reason for referral, urgency level, specialist services requested, what the referring provider hopes the specialist will provide. Exclude: detailed clinical history, examination findings, treatment details.',
        writingStyleOverride: 'Formal professional letter style',
        additionalInstructionsOverride: `Write the opening of a professional clinical referral letter including:
- Reason for referral (specific question or service being requested)
- Urgency level (routine, soon, urgent, emergency)
- What the referring provider is hoping the specialist will provide (encounter, surgery, advanced imaging, etc.)

Address it as: "Dear Colleague" (or to the specialist if named in the facts).
Sign off placeholder: [REFERRING VET NAME], [CLINIC NAME]`,
      },
      {
        key: 'corti-subjective',
        nameOverride: 'Patient History',
        contentOverride: 'Include: presenting complaint and duration, relevant past medical history, current medications, allergies. Exclude: physical examination findings, laboratory results, imaging results.',
        writingStyleOverride: 'Clinical narrative, chronological, professional clinical language',
        additionalInstructionsOverride: `Provide a concise clinical history of the patient:
- Patient demographics (age, sex, weight)
- Presenting complaint and duration
- Relevant past medical history
- Vaccination status if relevant
- Current medications

Keep to essential information the specialist needs. 1-2 paragraphs.`,
      },
      {
        key: 'corti-objective',
        nameOverride: 'Clinical Findings',
        contentOverride: 'Include: physical examination findings, laboratory results with values, imaging findings, treatment response. Exclude: patient history, subjective complaints, medication lists.',
        writingStyleOverride: 'Structured clinical format, professional',
        additionalInstructionsOverride: `Summarise the key clinical findings from examination and any diagnostics performed:
- Relevant physical examination findings
- Laboratory results (include values and reference ranges if available)
- Imaging findings
- Response to any treatment already attempted

Include both positive and pertinent negative findings relevant to the referral reason.`,
      },
      {
        key: 'corti-plan',
        nameOverride: 'Current Treatment',
        contentOverride: 'Include: current medications with doses and frequency, procedures already performed, dietary management, patient compliance and treatment response. Exclude: recommended future tests, referral details, examination findings.',
        writingStyleOverride: 'Concise list format',
        additionalInstructionsOverride: `List the current treatment the patient is receiving:
- All current medications with doses, frequency, and duration so far
- Any procedures already performed
- Dietary management in place
- Owner compliance and response to treatment so far

This helps the specialist understand what has already been tried and the patient's response.`,
      },
    ],
  },
  // Lab Order: corti-* default sections with provider-specific overrides.
  // The vetai-lab-request Directus template exists but returns 500; these overrides produce excellent output.
  'lab-order': {
    sections: [
      {
        key: 'corti-plan',
        nameOverride: 'Requested Tests',
        contentOverride: 'Include: laboratory tests mentioned, diagnostic tests, blood work, urinalysis, imaging requests, sample types, collection requirements, test priority. Exclude: clinical history, examination findings, treatment plans.',
        writingStyleOverride: 'Structured list, clinical terminology appropriate',
        formatRuleOverride: 'Grouped list by test category (haematology, biochemistry, endocrine, infectious disease, etc.)',
        additionalInstructionsOverride: `List the laboratory tests being requested based on the encounter findings:
- Test name (e.g., Complete Blood Count, Serum Chemistry Panel, Urinalysis, T4, fPL)
- Sample type required (blood, urine, faecal, tissue, etc.)
- Special collection requirements (fasting, timed collection, specific tube)
- Priority level (routine, urgent, STAT)

Group tests logically (haematology, biochemistry, endocrine, infectious disease, etc.).`,
      },
      {
        key: 'corti-assessment',
        nameOverride: 'Clinical Indication',
        contentOverride: 'Include: presenting complaint, relevant history, key examination findings, differential diagnoses, testing rationale. Exclude: treatment plans, medication details, follow-up scheduling, lab test names.',
        writingStyleOverride: 'Concise clinical narrative, professional tone for lab communication',
        additionalInstructionsOverride: `Provide the clinical context for why these tests are being requested:
- Presenting complaint and relevant history
- Key examination findings
- Differential diagnoses being investigated
- Whether this is initial workup, monitoring, or follow-up testing
- Any previous relevant results to compare against

Keep it concise (3-5 sentences) — enough for the lab to understand the clinical picture.`,
      },
      {
        key: 'corti-patient-summary',
        nameOverride: 'Special Instructions',
        contentOverride: 'Include: sample handling notes, result urgency, add-on test requests, reference lab vs in-house processing, preferred contact method. Exclude: clinical history, examination findings, test names, treatment plans.',
        writingStyleOverride: 'Brief, specific notes',
        additionalInstructionsOverride: `Note any special instructions for sample handling or result reporting:
- Urgency of results
- Specific panels or add-on tests if initial results are abnormal
- Preferred contact method for results
- Any samples being sent to external reference lab vs in-house

If no special instructions, state "Routine processing. Report results to attending physician."`,
      },
    ],
  },
  // Shift Handoff: corti-* sections with handoff-specific overrides.
  'shift-handoff': {
    sections: [
      {
        key: 'corti-subjective',
        nameOverride: 'Patients in Care',
        contentOverride: 'Include: all patients currently under care, their presenting complaints, key history, and current status. Exclude: billing details, non-clinical information.',
        writingStyleOverride: 'Concise clinical summary, bulleted list per patient',
        additionalInstructionsOverride: `Summarise each patient currently under care:
- Patient name, age/sex, presenting complaint
- Key history points and active problems
- Current clinical status (stable, guarded, critical)
- Code status if relevant

List each patient as a separate bullet point.`,
      },
      {
        key: 'corti-assessment',
        nameOverride: 'Pending Tasks & Follow-Ups',
        contentOverride: 'Include: outstanding tasks, pending diagnostics, monitoring requirements, medications due. Exclude: completed items, resolved issues.',
        writingStyleOverride: 'Action-oriented checklist format',
        additionalInstructionsOverride: `List all pending tasks for the incoming shift:
- Diagnostics pending (labs, imaging)
- Medications due and timing
- Monitoring requirements (vital checks, recheck times)
- Any outstanding patient/family communications

Prioritise by urgency.`,
      },
      {
        key: 'corti-plan',
        nameOverride: 'Handoff Notes',
        contentOverride: 'Include: concerns to watch for, owner expectations, special instructions, anything the incoming team must know. Exclude: completed treatments, resolved items.',
        writingStyleOverride: 'Direct, clear clinical handoff tone',
        additionalInstructionsOverride: `Provide any additional handoff notes:
- Specific concerns or changes to watch for
- Patient/family expectations or pending communications
- Special instructions for specific patients
- Escalation criteria and on-call contacts
- Any other critical information for the incoming team`,
      },
    ],
  },
};

// Map document types to agent roles for trace entries
const DOCUMENT_ROLE_MAP: Record<DocumentType, WorkflowAgentRole> = {
  'soap-note': 'document',
  'after-visit-summary': 'patient-communication',
  'discharge-instructions': 'patient-communication',
  'referral-letter': 'document',
  'prescription': 'prescription',
  'lab-order': 'document',
  'follow-up-plan': 'follow-up',
  'shift-handoff': 'document',
};

// ============================================================================
// CONTEXT BUILDERS
// ============================================================================

/**
 * Simplify full Fact objects into the minimal shape Corti's document API expects.
 */
function simplifyFacts(facts: Fact[]): SimplifiedFact[] {
  return facts
    .filter(f => !f.isDiscarded)
    .map(f => ({
      text: f.text,
      source: 'core' as const,
      group: f.group || undefined,
    }));
}

/**
 * Build the context array for Corti's document generation API.
 * Corti requires EXACTLY 1 context entry of type 'facts'.
 * We inject provider assessment, patient info, evidence, and prior context as additional
 * fact entries with source 'user' so everything travels in a single facts array.
 */
function buildDocumentContext(facts: Fact[], request: WorkflowRequest): DocumentContext[] {
  const simplified = simplifyFacts(facts);

  // Inject provider's manual entries as additional facts (these aren't in the extracted facts)
  if (request.providerDiagnosis) {
    simplified.push({ text: `Provider Diagnosis: ${request.providerDiagnosis}`, source: 'user' });
  }
  if (request.providerTreatmentPlan) {
    simplified.push({ text: `Treatment Plan: ${request.providerTreatmentPlan}`, source: 'user' });
  }
  if (request.providerNotes) {
    simplified.push({ text: `Provider Notes: ${request.providerNotes}`, source: 'user' });
  }

  // Patient info as a fact
  const patientHeader = formatPatientHeader(request.patientInfo);
  if (patientHeader) {
    simplified.push({ text: `Patient: ${patientHeader}`, source: 'user' });
  }

  // Evidence findings from uploaded files
  if (request.evidenceFindings && request.evidenceFindings.length > 0) {
    for (const f of request.evidenceFindings) {
      simplified.push({ text: `[${f.group}] ${f.text}`, source: 'user', group: f.group });
    }
  }

  // Prior encounter context
  if (request.priorContext && request.priorContext.length > 0) {
    for (const pc of request.priorContext) {
      const parts: string[] = [`Prior visit ${pc.date}`];
      if (pc.diagnosis) parts.push(`Dx: ${pc.diagnosis}`);
      if (pc.facts.length > 0) {
        parts.push(pc.facts.map(f => `${f.text}`).join('; '));
      }
      simplified.push({ text: parts.join(' — '), source: 'user', group: 'history' });
    }
  }

  return [{ type: 'facts', data: simplified }];
}

function formatPatientHeader(patientInfo?: PatientContext): string | null {
  if (!patientInfo) return null;

  const parts: string[] = [];
  if (patientInfo.name) parts.push(`Name: ${patientInfo.name}`);
  if (patientInfo.age) parts.push(`Age: ${patientInfo.age}`);
  if (patientInfo.sex) parts.push(`Sex: ${patientInfo.sex}`);
  if (patientInfo.weight != null) {
    parts.push(`Weight: ${patientInfo.weight} ${patientInfo.weightUnit || 'kg'}`);
  }

  return parts.length > 0 ? parts.join(' | ') : null;
}

// ============================================================================
// SECTION NORMALIZATION
// ============================================================================

/**
 * Map Corti's response sections ({key, name, text}) to the frontend format ({key, title, content}).
 */
function normalizeCortiSections(
  sections: Array<{ key: string; name?: string; text?: string; title?: string; content?: string }>
): DocumentSection[] {
  return sections.map(s => ({
    key: s.key,
    title: s.name || s.title || s.key,
    content: s.text || s.content || '',
  }));
}

// ============================================================================
// MEDICATION DETECTION
// ============================================================================

function groupFacts(facts: Fact[]): Record<string, Fact[]> {
  return facts.reduce((acc, fact) => {
    if (!fact.isDiscarded) {
      const group = fact.group || 'other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(fact);
    }
    return acc;
  }, {} as Record<string, Fact[]>);
}

/**
 * Detect whether any facts mention medications
 */
function hasMedicationFacts(facts: Fact[]): boolean {
  const grouped = groupFacts(facts);
  if (grouped['medications'] && grouped['medications'].length > 0) return true;
  if (grouped['plan'] && grouped['plan'].length > 0) {
    return grouped['plan'].some(f => {
      const lower = f.text.toLowerCase();
      return (
        lower.includes('prescri') ||
        lower.includes('medication') ||
        lower.includes('drug') ||
        lower.includes('dose') ||
        lower.includes('mg') ||
        lower.includes('tablet') ||
        lower.includes('capsule') ||
        lower.includes('injection') ||
        lower.includes('antibiotic') ||
        lower.includes('anti-inflammatory') ||
        lower.includes('nsaid') ||
        lower.includes('steroid')
      );
    });
  }
  return false;
}

// ============================================================================
// POST-PROCESSING PARSERS (kept from original)
// ============================================================================

/**
 * Parse prescription items from section content.
 */
function parsePrescriptionsFromText(text: string): PrescriptionItem[] {
  const items: PrescriptionItem[] = [];

  // Try JSON first (Corti may return structured JSON)
  try {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.prescriptions && Array.isArray(parsed.prescriptions)) {
        return parsed.prescriptions;
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      if (parsed.prescriptions && Array.isArray(parsed.prescriptions)) {
        return parsed.prescriptions;
      }
    }
  } catch {
    // Not valid JSON, fall through to text parsing
  }

  // Parse structured text sections for each medication
  const medBlocks = text.split(/(?:^|\n)(?:\d+\.|###?\s|\*\*)/);

  for (const block of medBlocks) {
    if (!block.trim()) continue;

    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const drugLine = lines[0].replace(/\*\*/g, '').replace(/^\d+\.\s*/, '').trim();
    if (!drugLine || drugLine.length > 100) continue;

    const item: PrescriptionItem = {
      drug: drugLine,
      dose: extractField(lines, ['dose', 'dosage']) || 'See provider instructions',
      route: extractField(lines, ['route']) || 'PO',
      frequency: extractField(lines, ['frequency', 'schedule', 'times']) || 'As directed',
      duration: extractField(lines, ['duration', 'length', 'days', 'weeks']) || 'As directed',
      instructions: extractField(lines, ['instruction', 'directions', 'give']) || `Administer ${drugLine} as directed by your physician.`,
    };

    const doseCalc = extractField(lines, ['calculation', 'calc', 'mg/kg']);
    if (doseCalc) item.doseCalculation = doseCalc;

    const quantity = extractField(lines, ['quantity', 'qty', 'dispense']);
    if (quantity) item.quantity = quantity;

    const warningLines = lines.filter(l => {
      const lower = l.toLowerCase();
      return lower.includes('warning') || lower.includes('caution') || lower.includes('side effect') || lower.includes('monitor');
    });
    if (warningLines.length > 0) {
      item.warnings = warningLines.map(l => l.replace(/^[-*]\s*/, '').replace(/^(warnings?|cautions?|side effects?)[:\s]*/i, '').trim());
    }

    items.push(item);
  }

  return items;
}

function extractField(lines: string[], keywords: string[]): string | undefined {
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          return line.substring(colonIndex + 1).trim();
        }
        const dashIndex = line.indexOf(' - ');
        if (dashIndex !== -1) {
          return line.substring(dashIndex + 3).trim();
        }
      }
    }
  }
  return undefined;
}

/**
 * Parse follow-up suggestion from section content.
 */
function parseFollowUpFromText(text: string): FollowUpSuggestion | null {
  // Try JSON first
  try {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.recommendedDate || parsed.reason) return parsed as FollowUpSuggestion;
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      if (parsed.recommendedDate || parsed.reason) return parsed as FollowUpSuggestion;
    }
  } catch {
    // Fall through to text parsing
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const timingLine = lines.find(l => {
    const lower = l.toLowerCase();
    return lower.includes('follow') || lower.includes('recheck') || lower.includes('days') || lower.includes('weeks');
  });

  if (!timingLine) return null;

  const dayMatch = text.match(/(\d+)\s*(?:to\s*\d+\s*)?days?/i);
  const weekMatch = text.match(/(\d+)\s*(?:to\s*\d+\s*)?weeks?/i);

  let daysOut = 14;
  if (dayMatch) {
    daysOut = parseInt(dayMatch[1], 10);
  } else if (weekMatch) {
    daysOut = parseInt(weekMatch[1], 10) * 7;
  }

  const recommendedDate = new Date(Date.now() + daysOut * 24 * 60 * 60 * 1000).toISOString();

  let type: FollowUpSuggestion['type'] = 'recheck';
  const lower = text.toLowerCase();
  if (lower.includes('lab') || lower.includes('blood') || lower.includes('test')) type = 'lab-recheck';
  else if (lower.includes('wound') || lower.includes('suture') || lower.includes('stitch')) type = 'wound-check';
  else if (lower.includes('imag') || lower.includes('x-ray') || lower.includes('scan')) type = 'imaging';

  const monitoringInstructions: string[] = [];
  const warningSignsForPatient: string[] = [];

  const monitorSection = text.indexOf('Monitor');
  const warningSection = text.indexOf('Warning');
  const callSection = text.indexOf('Call');

  if (monitorSection !== -1) {
    const endIdx = warningSection !== -1 ? warningSection : (callSection !== -1 ? callSection : text.length);
    const monitorText = text.substring(monitorSection, endIdx);
    monitorText.split('\n').forEach(line => {
      const cleaned = line.replace(/^[-*]\s*/, '').trim();
      if (cleaned && !cleaned.startsWith('Monitor')) {
        monitoringInstructions.push(cleaned);
      }
    });
  }

  if (warningSection !== -1 || callSection !== -1) {
    const startIdx = warningSection !== -1 ? warningSection : callSection;
    const warningText = text.substring(startIdx);
    warningText.split('\n').forEach(line => {
      const cleaned = line.replace(/^[-*]\s*/, '').trim();
      if (cleaned && !cleaned.startsWith('Warning') && !cleaned.startsWith('Call')) {
        warningSignsForPatient.push(cleaned);
      }
    });
  }

  return {
    recommendedDate,
    reason: timingLine.replace(/^[-*#]\s*/, '').trim(),
    type,
    monitoringInstructions: monitoringInstructions.length > 0 ? monitoringInstructions : undefined,
    warningSignsForPatient: warningSignsForPatient.length > 0 ? warningSignsForPatient : undefined,
  };
}

// ============================================================================
// DOCUMENT GENERATION SERVICE
// ============================================================================

class WorkflowDocumentService {
  private client: CortiClient;

  constructor(client: CortiClient) {
    this.client = client;
  }

  /**
   * Generate a single document using Corti's v2 document generation API.
   */
  async generateDocument(
    docType: DocumentType,
    interactionId: string,
    facts: Fact[],
    request: WorkflowRequest,
  ): Promise<GeneratedDocument | null> {
    const config = TEMPLATE_CONFIG[docType];
    const typeInfo = DOCUMENT_TYPE_INFO[docType];
    const context = buildDocumentContext(facts, request);

    // Build the payload
    const payload: DocumentGenerationPayload = {
      context,
      outputLanguage: request.language ?? 'en',
      name: request.patientInfo?.name
        ? `${typeInfo.title} - ${request.patientInfo.name}`
        : typeInfo.title,
      documentationMode: 'routed_parallel',
    };

    // Use template key if available, otherwise runtime-assembled sections (with optional overrides)
    if (config.templateKey) {
      payload.templateKey = config.templateKey;
    } else if (config.sections) {
      payload.template = { sections: config.sections };
    }

    try {
      const result = await this.client.generateDocumentRaw(interactionId, payload);
      const sections = normalizeCortiSections(result.sections || []);

      if (sections.length === 0) {
        console.warn(`[WorkflowDocGen] ${docType}: Corti returned 0 sections`);
      }

      return {
        type: docType,
        title: typeInfo.title,
        sections,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[WorkflowDocGen] Error generating ${docType}:`, errMsg);
      if (error && typeof error === 'object' && 'details' in error) {
        console.error(`[WorkflowDocGen] Corti API details:`, JSON.stringify((error as { details: unknown }).details, null, 2));
      }
      return null;
    }
  }
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

/**
 * Run the complete workflow pipeline.
 * Takes encounter facts + transcript and generates all requested documents
 * in parallel via Corti's v2 document generation API.
 */
export async function runWorkflowPipeline(request: WorkflowRequest): Promise<WorkflowResponse> {
  const pipelineStart = Date.now();
  const trace: WorkflowTraceEntry[] = [];
  const documents: GeneratedDocument[] = [];
  let followUp: FollowUpSuggestion | null = null;

  // Filter out discarded facts once
  const activeFacts = request.facts.filter(f => !f.isDiscarded);
  if (activeFacts.length === 0) {
    console.warn('[WorkflowPipeline] No active facts provided');
    return {
      documents: [],
      agentTrace: [{
        agent: 'document',
        status: 'error',
        duration: 0,
        documentsGenerated: [],
        error: 'No active facts provided. Record a encounter first.',
      }],
      totalDuration: Date.now() - pipelineStart,
    };
  }

  // Create the document generation service
  const client = createCortiClientFromEnv();
  const service = new WorkflowDocumentService(client);

  // Collect all document types to generate
  const docsToGenerate = [...request.documents];

  // Auto-add prescription if medications are mentioned but not explicitly requested
  const prescriptionRequested = request.documents.includes('prescription');
  if (!prescriptionRequested && hasMedicationFacts(activeFacts)) {
    docsToGenerate.push('prescription');
  }

  // Always generate follow-up-plan for follow-up suggestion extraction,
  // even if it wasn't explicitly requested (we just won't include the doc)
  const followUpDocRequested = request.documents.includes('follow-up-plan');
  const needsFollowUpGeneration = !docsToGenerate.includes('follow-up-plan');
  if (needsFollowUpGeneration) {
    docsToGenerate.push('follow-up-plan');
  }

  // Generate ALL documents in parallel
  const results = await Promise.allSettled(
    docsToGenerate.map(async (docType) => {
      const start = Date.now();
      const doc = await service.generateDocument(
        docType,
        request.interactionId,
        activeFacts,
        request,
      );
      return { docType, doc, duration: Date.now() - start };
    })
  );

  // Process results
  const traceByRole = new Map<WorkflowAgentRole, { generated: DocumentType[]; duration: number; error?: string }>();

  for (const result of results) {
    if (result.status === 'rejected') {
      continue;
    }

    const { docType, doc, duration } = result.value;
    const role = DOCUMENT_ROLE_MAP[docType];

    // Initialize trace entry for this role
    if (!traceByRole.has(role)) {
      traceByRole.set(role, { generated: [], duration: 0 });
    }
    const roleTrace = traceByRole.get(role)!;
    roleTrace.duration += duration;

    if (!doc) {
      roleTrace.error = roleTrace.error
        ? `${roleTrace.error}; ${docType} failed`
        : `${docType} failed`;
      continue;
    }

    // Post-process prescription: extract structured items
    // Note: Prescription summary removed - the new template format is already client-friendly
    if (docType === 'prescription') {
      const allContent = doc.sections.map(s => s.content).join('\n');
      const prescriptionItems = parsePrescriptionsFromText(allContent);
      // Store parsed items for potential future use (e.g., structured data export)
      // but don't modify the document sections
    }

    // Post-process follow-up: extract suggestion
    if (docType === 'follow-up-plan') {
      const allContent = doc.sections.map(s => s.content).join('\n');
      const suggestion = parseFollowUpFromText(allContent);
      if (suggestion) {
        followUp = suggestion;
      }
    }

    // Only include the document in the response if it was explicitly requested
    // (or auto-added like prescription)
    const wasExplicitlyRequested = request.documents.includes(docType) ||
      (docType === 'prescription' && !prescriptionRequested && hasMedicationFacts(activeFacts));
    const isFollowUpOnlyForSuggestion = docType === 'follow-up-plan' && !followUpDocRequested;

    if (wasExplicitlyRequested && !isFollowUpOnlyForSuggestion) {
      documents.push(doc);
      roleTrace.generated.push(docType);
    } else if (docType === 'follow-up-plan' && followUpDocRequested) {
      documents.push(doc);
      roleTrace.generated.push(docType);
    }
  }

  // Build trace entries
  for (const [role, data] of traceByRole) {
    trace.push({
      agent: role,
      status: data.generated.length > 0 || (role === 'follow-up' && followUp) ? 'success' : 'error',
      duration: data.duration,
      documentsGenerated: data.generated,
      error: data.error,
    });
  }

  return {
    documents,
    followUp: followUp || undefined,
    agentTrace: trace,
    totalDuration: Date.now() - pipelineStart,
  };
}

// Export for API route
export { DOCUMENT_TYPE_INFO, TEMPLATE_CONFIG };
