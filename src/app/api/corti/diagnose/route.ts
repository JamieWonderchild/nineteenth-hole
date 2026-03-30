// Corti Agentic Diagnosis Endpoint
// POST /api/corti/diagnose
//
// Orchestrates multiple specialized clinical agents to produce
// comprehensive diagnosis results including differentials, tests, and treatments.

import { NextRequest, NextResponse } from 'next/server';
import { getClinicalOrchestrator } from '@/services/corti-agents';
import { handleCortiApiError } from '@/lib/corti-errors';
import type { DiagnoseRequest } from '@/types/agents';
import type { Fact } from '@/types/corti';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for full diagnosis pipeline

interface RequestBody {
  interactionId: string;
  facts: Fact[];
  patientId?: string;
  patientInfo?: {
    age?: string;
    sex?: string;
    weight?: number;
    weightUnit?: 'kg' | 'lbs';
  };
  transcript?: string;
  consultationType?: 'sick-visit' | 'wellness' | 'emergency' | 'follow-up';
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();

    // Validate required fields
    if (!body.interactionId) {
      return NextResponse.json(
        { error: 'Missing required field: interactionId' },
        { status: 400 }
      );
    }

    if (!body.facts || !Array.isArray(body.facts)) {
      return NextResponse.json(
        { error: 'Missing or invalid facts array' },
        { status: 400 }
      );
    }

    // Filter out discarded facts
    const activeFacts = body.facts.filter(f => !f.isDiscarded);

    if (activeFacts.length === 0) {
      return NextResponse.json(
        { error: 'No active facts provided. Cannot generate diagnosis.' },
        { status: 400 }
      );
    }

    // Get the orchestrator (initializes agents if needed)
    const orchestrator = await getClinicalOrchestrator();

    // Build the diagnosis request
    const diagnoseRequest: DiagnoseRequest = {
      interactionId: body.interactionId,
      facts: activeFacts,
      patientId: body.patientId,
      patientInfo: body.patientInfo,
      transcript: body.transcript,
    };

    // Run the full diagnosis pipeline
    const result = await orchestrator.diagnose(diagnoseRequest);

    // Return the complete diagnosis
    return NextResponse.json(result);
  } catch (error) {
    return handleCortiApiError(error, 'Diagnosis');
  }
}

// Health check for the diagnosis endpoint
export async function GET() {
  try {
    // Check if Corti credentials are configured
    const hasCredentials =
      !!process.env.CORTI_CLIENT_ID &&
      !!process.env.CORTI_CLIENT_SECRET &&
      !!process.env.CORTI_TENANT;

    if (!hasCredentials) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Corti credentials not configured',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      endpoint: '/api/corti/diagnose',
      method: 'POST',
      description: 'Corti Agentic Diagnosis Pipeline',
      agents: [
        'provider-triage',
        'provider-demographics',
        'provider-differential',
        'provider-diagnostic-test',
        'provider-treatment',
      ],
      experts: ['pubmed', 'drugbank'],
      requiredFields: ['interactionId', 'facts'],
      optionalFields: [
        'patientId',
        'patientInfo',
        'transcript',
        'consultationType',
      ],
    });
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
      },
      { status: 500 }
    );
  }
}
