// Corti Document Generation Endpoint
// POST /api/corti/generate-document
//
// Generates clinical documents (SOAP notes, client summaries) using Corti's
// built-in templates and the facts/transcript from a encounter.

import { NextRequest, NextResponse } from 'next/server';
import { createCortiClientFromEnv } from '@/services/corti-client';
import { handleCortiApiError } from '@/lib/corti-errors';
import { requireActiveOrg, isAuthError } from '@/lib/api-auth';
import type { Fact, DocumentGenerationPayload } from '@/types/corti';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Available document types mapped to Corti template keys
const DOCUMENT_TEMPLATES = {
  'soap-note': {
    templateKey: 'corti-soap',
    name: 'SOAP Note',
    description: 'Clinical documentation in SOAP format',
  },
  'after-visit-summary': {
    templateKey: 'corti-patient-summary',
    name: 'After-Visit Summary',
    description: 'Plain language summary for patient',
  },
} as const;

type DocumentType = keyof typeof DOCUMENT_TEMPLATES;

interface GenerateDocumentRequest {
  interactionId: string;
  facts: Fact[];
  transcript?: string;
  documentType: DocumentType;
  patientName?: string;
  acceptedCodes?: { icd10: string[]; cpt: string[] };
  language?: string;
}

interface GeneratedSection {
  key: string;
  title: string;
  content: string;
}

interface GenerateDocumentResponse {
  documentType: DocumentType;
  templateKey: string;
  name: string;
  sections: GeneratedSection[];
  generatedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveOrg();
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body: GenerateDocumentRequest = await request.json();

    // Validate required fields
    if (!body.interactionId) {
      return NextResponse.json(
        { error: 'Missing required field: interactionId' },
        { status: 400 }
      );
    }

    if (!body.documentType || !DOCUMENT_TEMPLATES[body.documentType]) {
      return NextResponse.json(
        { error: `Invalid documentType. Must be one of: ${Object.keys(DOCUMENT_TEMPLATES).join(', ')}` },
        { status: 400 }
      );
    }

    if (!body.facts || !Array.isArray(body.facts) || body.facts.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty facts array' },
        { status: 400 }
      );
    }

    const template = DOCUMENT_TEMPLATES[body.documentType];
    const client = createCortiClientFromEnv();

    // Transform facts to Corti's expected format (simplified)
    // Corti expects: { text: string, source: "core"|"system"|"user", group?: string }
    const simplifiedFacts = body.facts
      .filter(f => !f.isDiscarded)
      .map(f => ({
        text: f.text,
        source: 'core' as const,
        group: f.group || undefined,
      }));

    // Inject accepted medical codes as user-confirmed facts so Corti includes
    // them in the generated document (assessment = ICD-10, plan = CPT)
    const { icd10 = [], cpt = [] } = body.acceptedCodes ?? {};
    const codeFacts = [
      ...icd10.map(code => ({
        text: `Confirmed diagnosis: ${code}`,
        source: 'user' as const,
        group: 'assessment',
      })),
      ...cpt.map(code => ({
        text: `Confirmed procedure code: ${code}`,
        source: 'user' as const,
        group: 'plan',
      })),
    ];

    const allFacts = [...simplifiedFacts, ...codeFacts];

    // Build the document generation payload
    // Note: We only send facts, not transcript. Corti's transcript context expects
    // a specific object format (CommonTranscript), not a plain string.
    // The facts extracted from the transcript are sufficient for document generation.
    const payload: DocumentGenerationPayload = {
      context: [
        { type: 'facts', data: allFacts },
      ],
      templateKey: template.templateKey,
      outputLanguage: body.language ?? 'en',
      name: body.patientName
        ? `${template.name} - ${body.patientName}`
        : template.name,
      documentationMode: 'routed_parallel',
    };

    // Call Corti's document generation API
    const document = await client.generateDocumentRaw(body.interactionId, payload);

    // Format the response - Corti uses 'text' and 'name' for section content/title
    const response: GenerateDocumentResponse = {
      documentType: body.documentType,
      templateKey: template.templateKey,
      name: payload.name || template.name,
      sections: (document.sections || []).map((s) => ({
        key: s.key,
        title: s.name || s.title || s.key,
        content: s.text || s.content || '',
      })),
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleCortiApiError(error, 'GenerateDocument');
  }
}

// GET endpoint to list available document types
export async function GET() {
  return NextResponse.json({
    availableTypes: Object.entries(DOCUMENT_TEMPLATES).map(([key, value]) => ({
      type: key,
      templateKey: value.templateKey,
      name: value.name,
      description: value.description,
    })),
  });
}
