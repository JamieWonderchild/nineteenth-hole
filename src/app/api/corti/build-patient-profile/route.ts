import { NextRequest, NextResponse } from 'next/server';
import { getClinicalOrchestrator } from '@/services/corti-agents';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientInfo, encounters } = body;

    if (!encounters || !Array.isArray(encounters)) {
      return NextResponse.json(
        { error: 'Missing required field: encounters (array)' },
        { status: 400 }
      );
    }

    const orchestrator = await getClinicalOrchestrator();
    const profile = await orchestrator.buildPatientProfileFromEncounters(
      patientInfo || {},
      encounters
    );

    if (!profile) {
      return NextResponse.json(
        { error: 'Failed to build patient profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, profile });
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
