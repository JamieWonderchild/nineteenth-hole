import { NextRequest, NextResponse } from 'next/server';
import { getClinicalOrchestrator } from '@/services/corti-agents';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { soapContent, facts } = body;

    if (!soapContent || typeof soapContent !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: soapContent (string)' },
        { status: 400 }
      );
    }

    const orchestrator = await getClinicalOrchestrator();
    const extraction = await orchestrator.extractLabResultsFromConsultation(
      soapContent,
      facts || []
    );

    if (!extraction) {
      return NextResponse.json(
        { error: 'Failed to extract lab results' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, extraction });
  } catch (error) {
    console.error('[extract-lab-results] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract lab results',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
