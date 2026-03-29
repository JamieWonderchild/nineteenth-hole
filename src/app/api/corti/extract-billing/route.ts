import { NextRequest, NextResponse } from 'next/server';
import { getClinicalOrchestrator } from '@/services/corti-agents';

export const maxDuration = 60; // Allow Corti agent polling (up to 30s) to complete

export async function POST(request: NextRequest) {
  console.log('[extract-billing API] ========================================');
  console.log('[extract-billing API] POST request received');
  console.log('[extract-billing API] URL:', request.url);
  console.log('[extract-billing API] Headers:', Object.fromEntries(request.headers.entries()));

  try {
    const body = await request.json();
    console.log('[extract-billing API] Body parsed, facts:', body.facts?.length, 'catalog:', body.catalog?.length);
    const { facts, catalog, existingItems } = body;

    if (!Array.isArray(facts) || !Array.isArray(catalog)) {
      return NextResponse.json(
        { error: 'Missing required fields: facts, catalog (arrays)' },
        { status: 400 }
      );
    }

    if (facts.length === 0) {
      return NextResponse.json(
        { error: 'facts array must not be empty' },
        { status: 400 }
      );
    }

    if (catalog.length === 0) {
      return NextResponse.json(
        {
          success: true,
          extraction: {
            extractedItems: [],
            unmatchedFacts: facts.map(f => f.id),
            summary: { totalExtracted: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0 },
            extractedAt: new Date().toISOString(),
          },
          message: 'No catalog items available',
        },
        { status: 200 }
      );
    }

    const orchestrator = await getClinicalOrchestrator();
    const extraction = await orchestrator.extractBillingItems(
      facts,
      catalog,
      existingItems || []
    );

    if (!extraction) {
      return NextResponse.json(
        { error: 'Failed to extract billing items' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, extraction });
  } catch (error) {
    console.error('[extract-billing] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract billing items',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
