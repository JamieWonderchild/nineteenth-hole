import { NextRequest, NextResponse } from 'next/server';
import { createCortiClientFromEnv } from '@/services/corti-client';
import { requireActiveOrg, isAuthError } from '@/lib/api-auth';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveOrg();
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { facts, transcript, encounterType } = body;

    if (!Array.isArray(facts) || facts.length === 0) {
      return NextResponse.json(
        { error: 'facts array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Build clinical text from facts + optional transcript for richer context
    const factsText = (facts as Array<{ text: string; group: string }>)
      .map((f) => `[${f.group}] ${f.text}`)
      .join('\n');

    const encounterContext = encounterType === 'inpatient'
      ? 'SETTING: Inpatient hospital encounter. Probable and suspected diagnoses may be coded.\n\n'
      : encounterType === 'ed'
      ? 'SETTING: Emergency department encounter.\n\n'
      : '';

    const text = transcript
      ? `${encounterContext}CLINICAL TRANSCRIPT:\n${transcript}\n\nEXTRACTED FACTS:\n${factsText}`
      : `${encounterContext}CLINICAL FACTS:\n${factsText}`;

    const client = createCortiClientFromEnv();
    const codes = await client.predictCodes(text);

    // Separate ICD-10 diagnosis, ICD-10 procedure, and CPT codes; sort each by confidence
    const icd10 = codes
      .filter((c) => c.system === 'ICD-10-CM')
      .sort((a, b) => b.confidence - a.confidence);

    const cpt = codes
      .filter((c) => c.system === 'CPT')
      .sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({ success: true, icd10, cpt, all: codes });
  } catch (error) {
    console.error('[predict-codes] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to predict codes',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
