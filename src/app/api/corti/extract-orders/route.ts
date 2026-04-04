import { NextRequest, NextResponse } from 'next/server';
import { getClinicalOrchestrator } from '@/services/corti-agents';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planText, patientInfo } = body;

    if (!planText || typeof planText !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: planText (string)' },
        { status: 400 }
      );
    }

    if (planText.trim().length < 5) {
      return NextResponse.json({
        success: true,
        extraction: { orders: [], extractedAt: new Date().toISOString() },
        message: 'Plan text too short',
      });
    }

    const orchestrator = await getClinicalOrchestrator();
    const extraction = await orchestrator.extractOrdersFromPlan(
      planText,
      patientInfo || {}
    );

    if (!extraction) {
      return NextResponse.json(
        { error: 'Failed to extract orders from plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, extraction });
  } catch (error) {
    console.error('[extract-orders] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
