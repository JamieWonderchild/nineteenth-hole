import { NextRequest, NextResponse } from 'next/server';
import { getClinicalOrchestrator } from '@/services/corti-agents';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testName, resultValue, referenceRange, units, patientInfo, encounterFacts } = body;

    if (!testName || !resultValue) {
      return NextResponse.json(
        { error: 'Missing required fields: testName, resultValue' },
        { status: 400 }
      );
    }

    const orchestrator = await getClinicalOrchestrator();
    const triage = await orchestrator.triageLabResult(
      testName,
      resultValue,
      referenceRange,
      units,
      patientInfo || {},
      Array.isArray(encounterFacts) ? encounterFacts : []
    );

    if (!triage) {
      return NextResponse.json(
        { error: 'Failed to triage result' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, triage });
  } catch (error) {
    console.error('[triage-result] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to triage result',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
