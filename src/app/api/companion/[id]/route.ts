// Companion Chat API Route
// POST /api/companion/[id]
//
// Public endpoint for patients/caregivers to chat with the companion AI.
// No authentication required -- access is controlled via the access token.
// The [id] parameter is the session ID (for URL readability), but
// the access token in the body is what actually authorizes access.

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { chatWithCompanion } from '@/services/companion';
import type { CompanionContext } from '@/types/companion';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ============================================================================
// REQUEST / RESPONSE TYPES
// ============================================================================

interface ChatRequestBody {
  accessToken: string;
  message: string;
}

// ============================================================================
// GET HANDLER — fetch session context for the companion page
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: accessToken } = await params;

  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const convex = new ConvexHttpClient(convexUrl);
    const session = await convex.query(api.companions.getByAccessToken, { accessToken });

    if (!session) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    const ctx = session.context;
    return NextResponse.json({
      patientName: ctx.patientName,
      visitSummary: ctx.visitSummary,
      visitDate: ctx.visitDate,
      suggestions: [
        'What medications were prescribed?',
        'What should I watch for at home?',
        'When is the follow-up appointment?',
        'Are there any dietary changes needed?',
      ],
      contextVersion: session.contextVersion ?? 0,
    });
  } catch (error) {
    console.error('[Companion GET] Error:', error);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  try {
    const body: ChatRequestBody = await request.json();

    // Validate required fields
    if (!body.accessToken) {
      return NextResponse.json(
        { error: 'Missing required field: accessToken' },
        { status: 400 }
      );
    }

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid field: message' },
        { status: 400 }
      );
    }

    // Trim message and enforce a reasonable length limit
    const message = body.message.trim();
    if (message.length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message is too long. Maximum 5000 characters.' },
        { status: 400 }
      );
    }

    // Look up the session in Convex by access token
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const convex = new ConvexHttpClient(convexUrl);

    let session;
    try {
      session = await convex.query(api.companions.getByAccessToken, {
        accessToken: body.accessToken,
      });
    } catch (convexError) {
      console.error('[Companion Chat] Convex query error:', convexError);
      return NextResponse.json(
        { error: 'Failed to look up session' },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found, expired, or has been deactivated.' },
        { status: 404 }
      );
    }

    // Additional validation: check that the session ID matches the URL param
    // This prevents using a valid token to access a different session's URL
    if (session._id !== sessionId) {
      // This is a soft check -- we still proceed with the session found by token.
      // The token is the real auth mechanism, the URL ID is for readability.
      console.warn(
        '[Companion Chat] Session ID mismatch:',
        `URL param=${sessionId}, token session=${session._id}`
      );
    }

    // Check expiry (double-check; the Convex query also checks)
    const now = new Date();
    if (new Date(session.expiresAt) < now) {
      return NextResponse.json(
        { error: 'This companion session has expired. Please contact your physician.' },
        { status: 410 }
      );
    }

    // Check active status
    if (!session.isActive) {
      return NextResponse.json(
        { error: 'This companion session has been deactivated by your physician.' },
        { status: 410 }
      );
    }

    // Build the CompanionContext from the stored session data.
    // Map the Convex schema field names to the TypeScript interface field names.
    const storedContext = session.context;
    const context: CompanionContext = {
      patientName: storedContext.patientName,
      age: storedContext.age,
      visitSummary: storedContext.visitSummary,
      visitDate: storedContext.visitDate,
      diagnosis: storedContext.diagnosis,
      treatmentPlan: storedContext.treatmentPlan,
      medications: storedContext.medications,
      followUpDate: storedContext.followUpDate,
      followUpReason: storedContext.followUpReason,
      homeCareInstructions: storedContext.homeCareInstructions,
      warningSignsToWatch: storedContext.warningSignsToWatch,
      dietaryInstructions: storedContext.dietaryInstructions,
      activityRestrictions: storedContext.activityRestrictions,
      clinicName: storedContext.clinicName,
      clinicPhone: storedContext.clinicPhone,
      emergencyPhone: storedContext.emergencyPhone,
      chargedServices: storedContext.chargedServices,
    };

    // Call the companion AI via Corti
    let chatResponse;
    try {
      chatResponse = await chatWithCompanion(context, message, {
        cortiAgentId: session.cortiAgentId,
        cortiContextId: session.cortiContextId,
        sessionId: session._id,
      });
    } catch (aiError) {
      console.error('[Companion Chat] AI error:', aiError);
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error('[Companion Chat] Error details:', errMsg);

      if (aiError instanceof Error) {
        if (aiError.message.includes('CORTI_CLIENT_ID') || aiError.message.includes('Corti credentials')) {
          return NextResponse.json(
            { error: 'Server configuration error: AI service not configured', details: errMsg },
            { status: 500 }
          );
        }

        // Rate limit or overloaded
        if (aiError.message.includes('rate_limit') || aiError.message.includes('overloaded') || aiError.message.includes('503')) {
          return NextResponse.json(
            { error: 'The AI service is currently busy. Please try again in a moment.' },
            { status: 503 }
          );
        }

        // Auth errors
        if (aiError.message.includes('401') || aiError.message.includes('403') || aiError.message.includes('unauthorized')) {
          return NextResponse.json(
            { error: 'AI service authentication failed. Please check server configuration.', details: errMsg },
            { status: 500 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Failed to generate a response. Please try again.', details: errMsg },
        { status: 500 }
      );
    }

    // Persist Corti agent and context IDs (always update to ensure continuity)
    if (chatResponse.cortiAgentId) {
      convex.mutation(api.companions.setCortiIds, {
        accessToken: body.accessToken,
        cortiAgentId: chatResponse.cortiAgentId,
        cortiContextId: chatResponse.cortiContextId || '',
      }).catch((err) => {
        console.error('[Companion Chat] Failed to persist Corti IDs:', err);
      });
    }

    // Record the message in Convex (fire and forget -- don't block the response)
    convex.mutation(api.companions.recordMessage, {
      accessToken: body.accessToken,
    }).catch((err) => {
      console.error('[Companion Chat] Failed to record message count:', err);
    });

    return NextResponse.json({
      message: chatResponse.message,
      suggestions: chatResponse.suggestions,
    });
  } catch (error) {
    console.error('[Companion Chat] Error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'An unexpected error occurred', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
