import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCortiAgentClient } from '@/lib/corti-agent-client';
import { pollCortiTask } from '@/lib/corti-polling';
import { CAPABILITIES } from '@/lib/ai-capabilities';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  let body: { command: string; context: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { command, context } = body;
  if (!command?.trim()) return NextResponse.json({ error: 'command is required' }, { status: 400 });

  const capability = CAPABILITIES['tee-time-agent'];

  let client;
  try {
    client = getCortiAgentClient();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Corti not configured' }, { status: 503 });
  }

  let agentId: string | null = null;
  try {
    const agent = await client.createAgent(
      { name: `tee-agent-${Date.now()}`, description: capability.description, systemPrompt: capability.systemPrompt },
      true,
    );
    agentId = agent.id;

    const contextBlock = Object.entries(context ?? {})
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n');

    const message = [`CONTEXT:\n${contextBlock}`, `COMMAND: ${command}`].join('\n\n');

    const task = await client.sendTextMessage(agentId!, message);
    const { task: completed, timedOut, failed } = await pollCortiTask(client, agentId!, task, {
      label: 'tee-time-agent',
      maxAttempts: 120,
      pollInterval: 500,
    });

    if (timedOut) return NextResponse.json({ error: 'Agent timed out' }, { status: 504 });
    if (failed) return NextResponse.json({ error: 'Agent failed' }, { status: 500 });

    const parsed = client.parseJson(completed) as { intents: unknown[]; summary: string } | null;
    if (!parsed) return NextResponse.json({ error: 'Could not parse agent response' }, { status: 500 });

    return NextResponse.json({ ok: true, intents: parsed.intents ?? [], summary: parsed.summary ?? '' });
  } catch (e) {
    console.error('[tee-time-agent]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  } finally {
    if (agentId) client?.deleteAgent(agentId).catch(() => {});
  }
}
