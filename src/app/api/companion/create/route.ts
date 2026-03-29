// Create Companion Session API Route
// POST /api/companion/create
//
// Creates a new companion AI session for a patient.
// Generates a shareable URL with a crypto-random access token.
// Stores the session context in Convex for later retrieval.

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { createCompanionSession } from '@/services/companion';
import type { CompanionContext } from '@/types/companion';
import type { Id } from 'convex/_generated/dataModel';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 15;

// ============================================================================
// REQUEST / RESPONSE TYPES
// ============================================================================

interface CreateSessionRequestBody {
  encounterId: string;
  customInstructions?: string;
  expiryDays?: number;
  // Inline context -- the frontend builds this from encounter data
  context?: CompanionContext;
  // Alternative: raw encounter data for server-side context building
  rawData?: {
    facts: Array<{ id: string; text: string; group: string }>;
    transcript?: string;
    patientInfo: {
      name: string;
      age?: string;
      weight?: string;
    };
    documents?: {
      soapNote?: { sections: Array<{ key: string; title: string; content: string }> };
      afterVisitSummary?: { sections: Array<{ key: string; title: string; content: string }> };
      dischargeInstructions?: { sections: Array<{ key: string; title: string; content: string }> };
    };
    diagnosisResult?: {
      triage?: { urgencyLevel: string; redFlags: string[]; recommendedWorkflow: string; reasoning: string };
      differentials?: Array<{ condition: string; probability: string; reasoning: string }>;
      medications?: Array<{ drug: string; dose: string; route: string; frequency: string; duration: string }>;
    };
    clinicInfo?: {
      clinicName?: string;
      clinicPhone?: string;
      emergencyPhone?: string;
    };
    chargedServices?: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  };
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequestBody = await request.json();

    // Validate required fields
    if (!body.encounterId) {
      return NextResponse.json(
        { error: 'Missing required field: encounterId' },
        { status: 400 }
      );
    }

    // Build the companion context from either inline context or raw data
    let companionContext: CompanionContext;

    if (body.context) {
      // Inline context provided -- validate minimum required fields
      if (!body.context.patientName || !body.context.visitSummary || !body.context.visitDate) {
        return NextResponse.json(
          { error: 'Context must include at least: patientName, visitSummary, visitDate' },
          { status: 400 }
        );
      }
      companionContext = body.context;
    } else if (body.rawData) {
      // Build context from raw encounter data
      if (!body.rawData.patientInfo?.name) {
        return NextResponse.json(
          { error: 'rawData.patientInfo must include at least: name' },
          { status: 400 }
        );
      }
      if (!body.rawData.facts || body.rawData.facts.length === 0) {
        return NextResponse.json(
          { error: 'rawData.facts must be a non-empty array' },
          { status: 400 }
        );
      }

      companionContext = createCompanionSession(
        body.encounterId,
        body.rawData.facts,
        body.rawData.transcript,
        body.rawData.patientInfo,
        body.rawData.documents,
        body.rawData.diagnosisResult,
        body.rawData.clinicInfo,
        body.rawData.chargedServices
      );
    } else {
      return NextResponse.json(
        { error: 'Must provide either "context" or "rawData" in the request body' },
        { status: 400 }
      );
    }

    // Generate a crypto-random access token
    const accessToken = crypto.randomUUID();

    // Calculate expiry (default 30 days)
    const expiryDays = body.expiryDays ?? 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    const expiresAtISO = expiresAt.toISOString();

    // Store the session in Convex
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: 'Server configuration error: NEXT_PUBLIC_CONVEX_URL not set' },
        { status: 500 }
      );
    }

    const convex = new ConvexHttpClient(convexUrl);

    const convexContext = {
      patientName: companionContext.patientName,
      age: companionContext.age,
      weight: companionContext.weight,
      visitSummary: companionContext.visitSummary,
      visitDate: companionContext.visitDate,
      diagnosis: companionContext.diagnosis,
      treatmentPlan: companionContext.treatmentPlan,
      medications: companionContext.medications,
      followUpDate: companionContext.followUpDate,
      followUpReason: companionContext.followUpReason,
      homeCareInstructions: companionContext.homeCareInstructions,
      warningSignsToWatch: companionContext.warningSignsToWatch,
      dietaryInstructions: companionContext.dietaryInstructions,
      activityRestrictions: companionContext.activityRestrictions,
      clinicName: companionContext.clinicName,
      clinicPhone: companionContext.clinicPhone,
      emergencyPhone: companionContext.emergencyPhone,
      chargedServices: companionContext.chargedServices,
    };

    let sessionId: string;
    try {
      const result = await convex.mutation(api.companions.createSession, {
        encounterId: body.encounterId as Id<"encounters">,
        accessToken,
        context: convexContext,
        expiresAt: expiresAtISO,
      });
      sessionId = result;
    } catch (convexError) {
      console.error('[Companion Create] Convex mutation error:', convexError);
      return NextResponse.json(
        {
          error: 'Failed to create companion session in database',
          details: convexError instanceof Error ? convexError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Record usage if encounter has an orgId
    try {
      const encounter = await convex.query(api.encounters.getById, {
        id: body.encounterId as Id<"encounters">,
      });
      if (encounter?.orgId) {
        await convex.mutation(api.usage.record, {
          orgId: encounter.orgId,
          userId: encounter.providerId || 'system',
          type: 'companion',
        });
      }
    } catch (usageErr) {
      console.error('[Companion Create] Usage recording failed:', usageErr);
    }

    // Build the shareable URL
    const baseUrl = request.headers.get('origin') || request.headers.get('host') || '';
    const protocol = baseUrl.startsWith('http') ? '' : 'https://';
    const shareableUrl = `${protocol}${baseUrl}/companion/${accessToken}`;

    return NextResponse.json({
      sessionId,
      accessToken,
      shareableUrl,
      expiresAt: expiresAtISO,
    });
  } catch (error) {
    console.error('[Companion Create] Error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to create companion session', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
