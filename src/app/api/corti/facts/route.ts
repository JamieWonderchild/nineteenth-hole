import { NextRequest, NextResponse } from 'next/server';
import { createCortiClientFromEnv } from '@/services/corti-client';
import { requireActiveOrg, isAuthError } from '@/lib/api-auth';

// Extract clinical facts from text
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveOrg();
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { text, language } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "text" field in request body' },
        { status: 400 }
      );
    }

    const client = createCortiClientFromEnv();
    const facts = await client.extractFacts(text, language || 'en');

    return NextResponse.json({ facts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
