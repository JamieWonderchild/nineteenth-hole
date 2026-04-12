import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCortiAgentClient } from '@/lib/corti-agent-client';
import { pollCortiTask } from '@/lib/corti-polling';
import { CAPABILITIES, detectCapability, type CapabilityId } from '@/lib/ai-capabilities';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RequestBody {
  rawText: string;
  instruction: string;
  page: string;
  capabilityId?: CapabilityId;
  context?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { rawText, instruction, page, capabilityId, context } = body;

  if (!rawText?.trim() && !instruction?.trim()) {
    return NextResponse.json({ error: 'Provide text, instruction, or both' }, { status: 400 });
  }

  const resolvedCapabilityId = capabilityId ?? detectCapability(page ?? '', instruction ?? '');
  const capability = CAPABILITIES[resolvedCapabilityId];

  let client;
  try {
    client = getCortiAgentClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Corti not configured';
    console.error('[assistant] Corti init error:', msg);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  let agentId: string | null = null;

  try {
    // Create an ephemeral agent with the capability's system prompt
    const agent = await client.createAgent(
      {
        name: `golf-${capability.id}-${Date.now()}`,
        description: capability.description,
        systemPrompt: capability.systemPrompt,
      },
      true // ephemeral — auto-deleted after task completes
    );
    agentId = agent.id;

    // Build the user message: context data + instruction + raw text
    const contextLines = context
      ? Object.entries(context)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join('\n')
      : '';

    const userMessage = [
      contextLines && `CONTEXT:\n${contextLines}`,
      instruction && `INSTRUCTION: ${instruction}`,
      rawText && `DATA TO PROCESS:\n${rawText}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const task = await client.sendTextMessage(agentId, userMessage);
    const { task: completed, timedOut, failed } = await pollCortiTask(client, agentId!, task, {
      label: capability.id,
      maxAttempts: 120,
      pollInterval: 500,
    });

    if (timedOut) return NextResponse.json({ error: 'Agent timed out' }, { status: 504 });
    if (failed) return NextResponse.json({ error: 'Agent failed to process request' }, { status: 500 });

    const parsed = client.parseJson(completed);
    const rawResponse = client.extractText(completed);

    return NextResponse.json({
      capabilityId: resolvedCapabilityId,
      capabilityName: capability.name,
      outputDescription: capability.outputDescription,
      data: parsed,
      rawResponse,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[assistant] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    // Clean up ephemeral agent (best effort)
    if (agentId) {
      client?.deleteAgent(agentId).catch(() => {});
    }
  }
}
