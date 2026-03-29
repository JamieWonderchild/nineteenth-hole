import { NextRequest, NextResponse } from 'next/server';
import { getClinicalOrchestrator } from '@/services/corti-agents';
import { requireActiveOrg, isAuthError } from '@/lib/api-auth';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveOrg();
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { transcript } = body;

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: transcript' },
        { status: 400 }
      );
    }

    // Get orchestrator (initializes agents if needed)
    const orchestrator = await getClinicalOrchestrator();

    // Extract patient info using the form-filling agent
    const patientInfo = await orchestrator.extractPatientInfo(transcript);

    if (!patientInfo) {
      return NextResponse.json(
        { error: 'Failed to extract patient information' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      patientInfo,
    });
  } catch (error) {
    console.error('[extract-patient] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract patient information',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/corti/extract-patient',
    method: 'POST',
    description: 'Extract patient information from encounter transcript using AI',
    requiredFields: ['transcript'],
  });
}
