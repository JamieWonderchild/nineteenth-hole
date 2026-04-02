import { NextRequest, NextResponse } from 'next/server';
import { getCortiAgentClient } from '@/services/corti-agents';
import type { VoiceCommandIntent } from '@/types/voiceCommand';

export const runtime = 'nodejs';
export const maxDuration = 15;

const SYSTEM_PROMPT = `You are a voice command classifier for a medical platform used by doctors.
Given a short voice command transcript, return ONLY a JSON object — no markdown, no explanation.

Available actions:
- navigate: go to a section. destination: "dashboard" | "encounters" | "billing" | "catalog" | "settings"
- open_patient: open a patient chart. patientName: string (name as spoken)
- start_note: begin a dictation note. patientName?: string (optional)
- create_invoice: create an invoice. patientName?: string (optional)
- unknown: cannot classify

Examples:
"go to billing" → {"action":"navigate","destination":"billing"}
"open encounters" → {"action":"navigate","destination":"encounters"}
"switch to Jamie" → {"action":"open_patient","patientName":"Jamie"}
"open Sarah Chen" → {"action":"open_patient","patientName":"Sarah Chen"}
"start note for Max" → {"action":"start_note","patientName":"Max"}
"new note" → {"action":"start_note"}
"create invoice for Emma" → {"action":"create_invoice","patientName":"Emma"}
"invoice" → {"action":"create_invoice"}
"go home" → {"action":"navigate","destination":"dashboard"}`;

let agentId: string | null = null;

async function getOrCreateAgent(): Promise<string> {
  if (agentId) return agentId;
  const client = getCortiAgentClient();
  const agents = await client.listAgents();
  const existing = agents.find(a => a.name === 'voice-command-classifier');
  if (existing) {
    agentId = existing.id;
    return agentId;
  }
  const agent = await client.createAgent({
    name: 'voice-command-classifier',
    description: 'Classifies short doctor voice commands into structured intents',
    systemPrompt: SYSTEM_PROMPT,
  });
  agentId = agent.id;
  return agentId;
}

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();
    if (!transcript?.trim()) {
      return NextResponse.json({ intent: { action: 'unknown' } });
    }

    const client = getCortiAgentClient();
    const id = await getOrCreateAgent();
    const task = await client.sendTextMessage(id, transcript.trim());
    const intent = client.parseJsonFromTask<VoiceCommandIntent>(task);

    return NextResponse.json({ intent: intent ?? { action: 'unknown' } });
  } catch (err) {
    console.error('[voice-command] error:', err);
    return NextResponse.json({ intent: { action: 'unknown' } });
  }
}
