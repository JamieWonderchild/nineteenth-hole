// Case Reasoning Chat API Route
// POST /api/case-reasoning/chat
// Clerk-authenticated endpoint for provider free-form AI chat.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { chatWithVet } from '@/services/case-reasoning-chat';
import type { ClinicalChatFact, ClinicalChatPatientInfo } from '@/services/case-reasoning-chat';

export const runtime = 'nodejs';
export const maxDuration = 60; // Max allowed on Vercel Hobby plan

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ChatRequestBody {
  encounterId?: string;
  message: string;
  agentId?: string;
  contextId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId: clerkOrgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

      const [encounter, detail] = await Promise.all([
        convex.query(api.encounters.getById, { id: encounterId }),
        convex.query(api.encounters.getConsultationForReasoning, { encounterId }),
      ]);

      if (!encounter) {
        return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
      }

      // Ownership check
      if (clerkOrgId) {
        const org = await convex.query(api.organizations.getByClerkOrg, { clerkOrgId });
        if (!org || !encounter.orgId || encounter.orgId !== org._id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      } else {
        if (encounter.providerId !== userId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }

      // Aggregate facts from recordings
      const seenTexts = new Set<string>();

      if (detail?.factReconciliation) {
        for (const rf of detail.factReconciliation.reconciledFacts) {
          if (rf.resolution === 'keep-old' && rf.priorText) {
            const key = rf.priorText.toLowerCase().trim();
            if (!seenTexts.has(key)) {
              seenTexts.add(key);
              facts.push({ id: rf.priorFactId || rf.factId, text: rf.priorText, group: rf.group });
            }
          } else {
            const key = rf.text.toLowerCase().trim();
            if (!seenTexts.has(key)) {
              seenTexts.add(key);
              facts.push({ id: rf.factId, text: rf.text, group: rf.group });
            }
          }
        }
      } else if (detail?.recordings) {
        for (const rec of detail.recordings) {
          if (rec.facts) {
            for (const fact of rec.facts) {
              const key = fact.text.toLowerCase().trim();
              if (!seenTexts.has(key)) {
                seenTexts.add(key);
                facts.push(fact);
              }
            }
          }
        }
      }

      // Fetch patient info
      if (encounter.patientId) {
        const patient = await convex.query(api.patients.getPatientById, {
          id: encounter.patientId as Id<'patients'>,
        });
        if (patient) {
          patientInfo = {
            name: patient.name,
            age: patient.age,
            sex: patient.sex,
            weight: patient.weight,
            weightUnit: (patient.weightUnit as string) || undefined,
          };
        }
      }

      // Extract provider notes if available
      providerNotes = encounter.providerNotes
        ? {
            diagnosis: (encounter.providerNotes as { diagnosis?: string }).diagnosis,
            treatmentPlan: (encounter.providerNotes as { treatmentPlan?: string }).treatmentPlan,
          }
        : undefined;
    }

    // Send all facts to the agent - let Corti's intelligence determine relevance
    // Fact filtering was causing issues with multi-turn conversations where follow-up
    // questions needed different facts than the first question
    console.log('[CaseReasoning API] Sending all facts to agent. Count:', facts.length);

    // Call the chat service
    const result = await chatWithVet(facts, patientInfo, message, {
      agentId: body.agentId,
      contextId: body.contextId,
    }, providerNotes);

    return NextResponse.json({
      message: result.message,
      agentId: result.agentId,
      contextId: result.contextId,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('[CaseReasoning Chat] Error:', errMsg);
    if (errStack) console.error('[CaseReasoning Chat] Stack:', errStack);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to generate response', details: errMsg }, { status: 500 });
  }
}
