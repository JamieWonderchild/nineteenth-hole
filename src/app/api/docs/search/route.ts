// Docs Search API Route
// POST /api/docs/search
// Clerk-authenticated endpoint for AI-powered documentation search.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchDocs } from '@/services/docs-search';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface SearchRequestBody {
  query: string;
  agentId?: string;
  contextId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SearchRequestBody = await request.json();

    if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or empty query' }, { status: 400 });
    }
    if (body.query.length > 1000) {
      return NextResponse.json({ error: 'Query too long (max 1000 chars)' }, { status: 400 });
    }

    const result = await searchDocs(body.query.trim(), {
      agentId: body.agentId,
      contextId: body.contextId,
    });

    return NextResponse.json({
      message: result.message,
      agentId: result.agentId,
      contextId: result.contextId,
      suggestedSlugs: result.suggestedSlugs,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[DocsSearch API] Error:', errMsg);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to search docs', details: errMsg }, { status: 500 });
  }
}
