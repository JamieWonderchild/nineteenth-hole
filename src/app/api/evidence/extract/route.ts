// Evidence Extraction API Endpoint
// POST /api/evidence/extract - Extract findings from uploaded evidence files
// Uses Corti Agentic API with an ephemeral agent for file analysis.

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { getCortiAgentClient } from '@/services/corti-agents';
import type { CreateCortiAgentRequest, CortiMessagePart } from '@/types/corti';
import type { Id } from 'convex/_generated/dataModel';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Finding {
  id: string;
  text: string;
  group: string;
  confidence?: number;
}

const EVIDENCE_ANALYSIS_PROMPT = `You are a clinical lab result and diagnostic evidence analyzer. Your role is to extract all clinical findings from uploaded files (lab reports, imaging, clinical notes).

For each finding, provide:
- A clear description (include value, unit, and whether normal/abnormal if applicable)
- The category: "lab-result", "imaging-finding", "vitals", or "clinical-note"
- A confidence level from 0.0 to 1.0

Rules:
- Only include findings you can clearly identify from the document
- Note any abnormal values explicitly (e.g., "elevated", "low", "critical")
- Include reference ranges when visible
- For imaging, describe what you observe objectively
- If the document is unreadable or empty, say so

Format your response as JSON:
{"findings": [{"text": "BUN: 45 mg/dL (elevated, ref 7-27)", "group": "lab-result", "confidence": 0.95}]}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { evidenceFileId, encounterId } = body as {
      evidenceFileId: string;
      encounterId: string;
    };

    if (!evidenceFileId || !encounterId) {
      return NextResponse.json(
        { error: 'evidenceFileId and encounterId are required' },
        { status: 400 }
      );
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_CONVEX_URL' },
        { status: 500 }
      );
    }

    const convex = new ConvexHttpClient(convexUrl);

    // Mark as processing
    await convex.mutation(api.evidenceFiles.updateExtraction, {
      id: evidenceFileId as Id<"evidenceFiles">,
      extractionStatus: 'processing',
    });

    // Get the file info
    const files = await convex.query(api.evidenceFiles.getByConsultation, {
      encounterId: encounterId as Id<"encounters">,
    });
    const file = files.find(f => f._id === evidenceFileId);

    if (!file || !file.url) {
      await convex.mutation(api.evidenceFiles.updateExtraction, {
        id: evidenceFileId as Id<"evidenceFiles">,
        extractionStatus: 'failed',
      });
      return NextResponse.json({ error: 'File not found or no URL' }, { status: 404 });
    }

    // Create an ephemeral Corti agent for evidence analysis
    const client = getCortiAgentClient();

    const agentRequest: CreateCortiAgentRequest = {
      name: `evidence-${evidenceFileId.slice(0, 8)}-${Date.now().toString(36)}`,
      description: 'Clinical evidence file analyzer',
      systemPrompt: EVIDENCE_ANALYSIS_PROMPT,
    };

    const agent = await client.createAgent(agentRequest, true); // ephemeral

    // Build the message with file part + text instruction
    const parts: CortiMessagePart[] = [
      {
        type: 'file',
        mimeType: file.mimeType,
        uri: file.url,
        name: file.fileName,
      },
      {
        type: 'text',
        text: `Analyze this clinical evidence file "${file.fileName}" (${file.category}). Extract all clinical findings and format as the JSON structure specified in your instructions.`,
      },
    ];

    const task = await client.sendMessage(agent.id, {
      message: {
        role: 'user',
        parts,
      },
    });

    // Parse findings from the Corti agent response
    const parsed = client.parseJsonFromTask<{ findings: Array<{ text: string; group: string; confidence?: number }> }>(task);
    let findings: Finding[] = [];

    if (parsed?.findings && Array.isArray(parsed.findings)) {
      findings = parsed.findings
        .map((f) => ({
          id: '',
          text: String(f.text || ''),
          group: String(f.group || 'lab-result'),
          confidence: typeof f.confidence === 'number' ? f.confidence : undefined,
        }))
        .filter((f) => f.text);
    } else {
      // Fallback: try to extract text and parse bullet points
      const text = client.extractTextFromTask(task);
      if (text) {
        const lines = text.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'));
        findings = lines.map((line) => ({
          id: '',
          text: line.replace(/^[-*]\s*/, '').trim(),
          group: 'lab-result',
        })).filter(f => f.text);
      }
    }

    // Add IDs to findings
    const findingsWithIds = findings.map((f, i) => ({
      ...f,
      id: `evidence-${evidenceFileId}-${i}`,
    }));

    // Save findings to the evidence file
    await convex.mutation(api.evidenceFiles.updateExtraction, {
      id: evidenceFileId as Id<"evidenceFiles">,
      extractedFindings: findingsWithIds,
      extractionStatus: 'completed',
    });

    return NextResponse.json({
      findings: findingsWithIds,
      fileId: evidenceFileId,
    });
  } catch (error) {
    console.error('[EvidenceExtract] Error:', error);

    // Try to mark as failed
    try {
      const body = await request.clone().json();
      if (body.evidenceFileId) {
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (convexUrl) {
          const convex = new ConvexHttpClient(convexUrl);
          await convex.mutation(api.evidenceFiles.updateExtraction, {
            id: body.evidenceFileId as Id<"evidenceFiles">,
            extractionStatus: 'failed',
          });
        }
      }
    } catch {
      // Ignore secondary errors
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Extraction failed' },
      { status: 500 }
    );
  }
}
