// TEST ONLY - Case Reasoning Test API Route
// POST /api/case-reasoning/test
// NO AUTH - For automated testing only. DO NOT USE IN PRODUCTION.

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { chatWithVet } from '@/services/case-reasoning-chat';
import type { ClinicalChatFact, ClinicalChatPatientInfo } from '@/services/case-reasoning-chat';

export const runtime = 'nodejs';
export const maxDuration = 30;

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ChatRequestBody {
  encounterId?: string;
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export async function POST(request: NextRequest) {
  // ONLY allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden - test endpoint not available in production' }, { status: 403 });
  }

  try {
    const body: ChatRequestBody = await request.json();

    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or empty message' }, { status: 400 });
    }
    if (body.message.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 chars)' }, { status: 400 });
    }

    const message = body.message.trim();

    let facts: ClinicalChatFact[] = [];
    let patientInfo: ClinicalChatPatientInfo = { name: 'General' };
    let providerNotes: { diagnosis?: string; treatmentPlan?: string } | undefined;

    // If a encounter is provided, fetch its context
    if (body.encounterId) {
      const encounterId = body.encounterId as Id<'encounters'>;

      try {
        const encounter = await convex.query(
          'encounters:getConsultationForReasoning' as any,
          { encounterId }
        );

        if (encounter && encounter.facts) {
          facts = encounter.facts.map((f: any) => ({
            text: f.text,
            group: f.group,
          }));

          // Get patient info if available
          if (encounter.patientId) {
            const patient = await convex.query('patients:getById' as any, {
              id: encounter.patientId,
            });
            if (patient) {
              patientInfo = {
                name: patient.name || 'Unknown',
                age: patient.age,
                weight: patient.weight,
                weightUnit: patient.weightUnit || 'kg',
              };
            }
          }

          // Get provider notes if available
          if (encounter.providerNotes) {
            providerNotes = {
              diagnosis: encounter.providerNotes.diagnosis,
              treatmentPlan: encounter.providerNotes.treatmentPlan,
            };
          }
        }
      } catch (error: any) {
        console.error('Error fetching encounter:', error);
        // Continue without encounter context
      }
    }

    // Call the chat service
    const result = await chatWithVet(facts, patientInfo, message, {}, providerNotes);

    // Return the response with task status for testing
    return NextResponse.json({
      message: result.message,
      agentId: result.agentId,
      contextId: result.contextId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in case reasoning test endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
