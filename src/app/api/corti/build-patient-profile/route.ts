import { NextRequest, NextResponse } from 'next/server';
import { createCortiClientFromEnv } from '@/services/corti-client';
import type { TemplateSection } from '@/types/corti';

export const maxDuration = 60;

// Section-level overrides for the patient profile — same pattern as after-visit-summary.
// Always picks up latest config on every call, no agent caching.
const PATIENT_PROFILE_SECTIONS: TemplateSection[] = [
  {
    key: 'corti-subjective',
    nameOverride: 'Overview',
    contentOverride: 'Include: patient demographics, major chronic conditions, allergy status, key background history. Exclude: recent visit details, pending items, treatment plans.',
    writingStyleOverride: 'Dense clinical shorthand, as if handing off to a colleague. No padding.',
    additionalInstructionsOverride: `Write 2-3 sentences maximum. Cover: who the patient is (age, sex), their major ongoing conditions, and allergy status.
Example: "58M with T2DM (poorly controlled), primary hypertension, and new hyperlipidaemia. NKDA. No prior hospitalisations documented."
Do not mention recent visits or pending actions here.`,
  },
  {
    key: 'corti-assessment',
    nameOverride: 'Recent',
    contentOverride: 'Include: last 1-2 encounter dates, chief complaint, key findings, diagnoses made, what was started or changed. Exclude: chronic background, medications unchanged, pending follow-up items.',
    writingStyleOverride: 'Tight clinical narrative, past tense, dense.',
    additionalInstructionsOverride: `Summarise the most recent encounter(s) in 2-4 sentences.
Cover: why the patient came in, what was found, what was diagnosed or changed, what was ordered or started.
Example: "Seen 2026-04-05 for fatigue and exertional SOB. HbA1c 8.4%, LDL 3.8, mild normocytic anaemia (Hb 11.8). Metformin uptitrated to 1g BD, atorvastatin 40mg nocte started. Iron studies, 24h Holter, and cardiology referral placed."
If multiple encounters, summarise the most recent first.`,
  },
  {
    key: 'corti-plan',
    nameOverride: 'Watch',
    contentOverride: 'Include: pending results, outstanding referrals, unresolved issues, items to monitor at next visit. Exclude: completed treatments, resolved problems, background history.',
    writingStyleOverride: 'Bullet-point style, action-oriented, brief.',
    additionalInstructionsOverride: `List what is unresolved, pending, or needs monitoring. 1-4 items maximum.
Example: "Iron studies pending — exclude iron deficiency vs CKD-related anaemia. Cardiology referral placed — Holter requested for palpitations. Glycaemic control suboptimal — recheck HbA1c in 3 months."
If nothing is pending, write: "No outstanding items documented."
Do not repeat information from Overview or Recent.`,
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientInfo, encounters } = body;

    if (!encounters || !Array.isArray(encounters) || encounters.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: encounters (non-empty array)' },
        { status: 400 }
      );
    }

    const client = createCortiClientFromEnv();

    // Create a fresh interaction for this profile build
    const interaction = await client.createInteractionV2();
    const interactionId = interaction.id;

    // Aggregate facts from all encounters into Corti context format.
    // Patient demographics first, then encounter facts newest-first.
    const facts: Array<{ text: string; source: 'core'; group: string }> = [];

    // Patient header facts
    if (patientInfo?.name) facts.push({ text: `Patient: ${patientInfo.name}`, source: 'core', group: 'demographics' });
    if (patientInfo?.age) facts.push({ text: `Age: ${patientInfo.age}`, source: 'core', group: 'demographics' });
    if (patientInfo?.sex) facts.push({ text: `Sex: ${patientInfo.sex}`, source: 'core', group: 'demographics' });
    if (patientInfo?.weight) facts.push({ text: `Weight: ${patientInfo.weight}`, source: 'core', group: 'demographics' });
    facts.push({
      text: `Allergies: ${(patientInfo?.allergies ?? []).length > 0 ? patientInfo.allergies.join(', ') : 'none documented'}`,
      source: 'core',
      group: 'allergies',
    });

    // Encounter facts (newest-first, already ordered that way from Convex)
    for (const enc of encounters) {
      if (enc.date) {
        facts.push({ text: `Encounter date: ${enc.date}`, source: 'core', group: 'history-of-present-illness' });
      }
      if (enc.chiefComplaint) {
        facts.push({ text: `Chief complaint: ${enc.chiefComplaint}`, source: 'core', group: 'chief-complaint' });
      }
      if (enc.icd10Codes?.length > 0) {
        facts.push({ text: `Diagnoses: ${enc.icd10Codes.join(', ')}`, source: 'core', group: 'assessment' });
      }
      // Key facts by group
      for (const [group, groupFacts] of Object.entries(enc.keyFacts ?? {})) {
        for (const fact of (groupFacts as string[]).slice(0, 8)) {
          facts.push({ text: fact, source: 'core', group });
        }
      }
      if (enc.planText) {
        facts.push({ text: `Plan: ${enc.planText}`, source: 'core', group: 'plan' });
      }
    }

    // Generate using section overrides — same mechanism as after-visit-summary
    const document = await client.generateDocumentRaw(interactionId, {
      context: [{ type: 'facts', data: facts }],
      template: { sections: PATIENT_PROFILE_SECTIONS },
      outputLanguage: 'en',
      name: patientInfo?.name ? `Clinical Profile — ${patientInfo.name}` : 'Clinical Profile',
      documentationMode: 'routed_parallel',
    });

    // Map returned sections to summarySections
    const summarySections = (document.sections ?? []).map((s: { key: string; name?: string; title?: string; text?: string; content?: string }) => ({
      title: s.name || s.title || s.key,
      content: s.text || s.content || '',
    })).filter((s: { title: string; content: string }) => s.content.trim().length > 0);

    // Return with required schema fields kept empty — profile display uses summarySections
    return NextResponse.json({
      success: true,
      profile: {
        summarySections,
        activeProblems: [],
        currentMedications: [],
        allergies: [],
        riskFactors: [],
        clinicalNarrative: '',
        careGaps: [],
        keyHistory: '',
      },
    });

  } catch (error) {
    console.error('[build-patient-profile] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to build patient profile',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
