import { NextRequest, NextResponse } from 'next/server';
import { getClinicalOrchestrator } from '@/services/corti-agents';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { existingFacts, newFacts } = body;

    if (!Array.isArray(existingFacts) || !Array.isArray(newFacts)) {
      return NextResponse.json(
        { error: 'Missing required fields: existingFacts, newFacts (arrays)' },
        { status: 400 }
      );
    }

    if (newFacts.length === 0) {
      return NextResponse.json(
        { error: 'newFacts array must not be empty' },
        { status: 400 }
      );
    }

    const orchestrator = await getClinicalOrchestrator();
    const reconciliation = await orchestrator.reconcileFacts(existingFacts, newFacts);

    if (!reconciliation) {
      return NextResponse.json(
        { error: 'Failed to reconcile facts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reconciliation,
    });
  } catch (error) {
    console.error('[reconcile-facts] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reconcile facts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
