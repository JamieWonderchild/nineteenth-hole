// Workflow Pipeline API Endpoint
// POST /api/workflow - Run the workflow pipeline to generate documents
// GET  /api/workflow - List available document types
//
// Replaces the diagnosis-centric pipeline with workflow automation.
// The provider diagnoses. This endpoint handles documentation, owner communication,
// prescriptions, and follow-up planning.

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { runWorkflowPipeline, DOCUMENT_TYPE_INFO, TEMPLATE_CONFIG } from '@/services/workflow-agents';
import { handleCortiApiError } from '@/lib/corti-errors';
import { requireActiveOrg, isAuthError } from '@/lib/api-auth';
import type { WorkflowRequest, DocumentType } from '@/types/workflow';
import type { Fact } from '@/types/corti';

export const runtime = 'nodejs';
export const maxDuration = 60; // Workflow pipeline may run multiple agents

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_DOCUMENT_TYPES: DocumentType[] = [
  'soap-note',
  'after-visit-summary',
  'discharge-instructions',
  'referral-letter',
  'prescription',
  'lab-order',
  'follow-up-plan',
  'shift-handoff',
];

interface ValidationError {
  field: string;
  message: string;
}

function validateWorkflowRequest(body: unknown): { valid: true; request: WorkflowRequest } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  const obj = body as Record<string, unknown>;

  // interactionId: required string
  if (!obj.interactionId || typeof obj.interactionId !== 'string') {
    errors.push({ field: 'interactionId', message: 'interactionId is required and must be a string' });
  }

  // facts: required non-empty array
  if (!obj.facts || !Array.isArray(obj.facts)) {
    errors.push({ field: 'facts', message: 'facts is required and must be an array' });
  } else if (obj.facts.length === 0) {
    errors.push({ field: 'facts', message: 'facts array must not be empty' });
  } else {
    // Validate that facts have the minimum required shape
    const invalidFacts = obj.facts.filter((f: unknown) => {
      if (!f || typeof f !== 'object') return true;
      const fact = f as Record<string, unknown>;
      if (typeof fact.text !== 'string' || !fact.text) return true;
      return false;
    });
    if (invalidFacts.length > 0) {
      errors.push({ field: 'facts', message: `${invalidFacts.length} facts are missing required "text" field` });
    }
  }

  // documents: required non-empty array of valid document types
  if (!obj.documents || !Array.isArray(obj.documents)) {
    errors.push({ field: 'documents', message: 'documents is required and must be an array of document types' });
  } else if (obj.documents.length === 0) {
    errors.push({ field: 'documents', message: 'documents array must not be empty. Specify at least one document type.' });
  } else {
    const invalidTypes = obj.documents.filter(
      (d: unknown) => typeof d !== 'string' || !VALID_DOCUMENT_TYPES.includes(d as DocumentType)
    );
    if (invalidTypes.length > 0) {
      errors.push({
        field: 'documents',
        message: `Invalid document type(s): ${invalidTypes.join(', ')}. Valid types: ${VALID_DOCUMENT_TYPES.join(', ')}`,
      });
    }
  }

  // transcript: optional string
  if (obj.transcript !== undefined && typeof obj.transcript !== 'string') {
    errors.push({ field: 'transcript', message: 'transcript must be a string if provided' });
  }

  // patientInfo: optional object with specific shape
  if (obj.patientInfo !== undefined) {
    if (typeof obj.patientInfo !== 'object' || obj.patientInfo === null) {
      errors.push({ field: 'patientInfo', message: 'patientInfo must be an object if provided' });
    } else {
      const pi = obj.patientInfo as Record<string, unknown>;
      if (pi.weight !== undefined && typeof pi.weight !== 'number') {
        errors.push({ field: 'patientInfo.weight', message: 'patientInfo.weight must be a number if provided' });
      }
      if (pi.weightUnit !== undefined && pi.weightUnit !== 'kg' && pi.weightUnit !== 'lbs') {
        errors.push({ field: 'patientInfo.weightUnit', message: 'patientInfo.weightUnit must be "kg" or "lbs" if provided' });
      }
    }
  }

  // vetDiagnosis, vetTreatmentPlan, providerNotes: optional strings
  for (const field of ['vetDiagnosis', 'vetTreatmentPlan', 'providerNotes'] as const) {
    if (obj[field] !== undefined && typeof obj[field] !== 'string') {
      errors.push({ field, message: `${field} must be a string if provided` });
    }
  }

  // evidenceFindings: optional array
  if (obj.evidenceFindings !== undefined && !Array.isArray(obj.evidenceFindings)) {
    errors.push({ field: 'evidenceFindings', message: 'evidenceFindings must be an array if provided' });
  }

  // priorContext: optional array
  if (obj.priorContext !== undefined && !Array.isArray(obj.priorContext)) {
    errors.push({ field: 'priorContext', message: 'priorContext must be an array if provided' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    request: {
      interactionId: obj.interactionId as string,
      facts: obj.facts as Fact[],
      documents: obj.documents as DocumentType[],
      transcript: obj.transcript as string | undefined,
      patientInfo: obj.patientInfo as WorkflowRequest['patientInfo'],
      providerDiagnosis: obj.providerDiagnosis as string | undefined,
      providerNotes: obj.providerNotes as string | undefined,
      evidenceFindings: obj.evidenceFindings as WorkflowRequest['evidenceFindings'],
      priorContext: obj.priorContext as WorkflowRequest['priorContext'],
    },
  };
}

// ============================================================================
// POST - Run the workflow pipeline
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveOrg();
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate
    const validation = validateWorkflowRequest(body);
    if (validation.valid === false) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const workflowRequest = validation.request;

    // Run the pipeline
    const result = await runWorkflowPipeline(workflowRequest);

    // Record usage for billing
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      try {
        const convex = new ConvexHttpClient(convexUrl);
        const encounter = await convex.query(api.encounters.getByInteractionId, {
          interactionId: workflowRequest.interactionId,
        });
        if (encounter?.orgId) {
          await convex.mutation(api.usage.record, {
            orgId: encounter.orgId,
            userId: encounter.providerId || 'system',
            type: 'document',
          });
        }
      } catch (usageErr) {
        console.error('[WorkflowAPI] Usage recording failed:', usageErr);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleCortiApiError(error, 'WorkflowAPI');
  }
}

// ============================================================================
// GET - List available document types
// ============================================================================

export async function GET() {
  const hasCredentials =
    !!process.env.CORTI_CLIENT_ID &&
    !!process.env.CORTI_CLIENT_SECRET &&
    !!process.env.CORTI_TENANT;

  return NextResponse.json({
    status: hasCredentials ? 'ok' : 'unconfigured',
    endpoint: '/api/workflow',
    description: 'Clinical Workflow Automation Pipeline - generates documents via Corti v2 document generation API',
    availableDocumentTypes: VALID_DOCUMENT_TYPES.map(type => {
      const config = TEMPLATE_CONFIG[type];
      return {
        type,
        title: DOCUMENT_TYPE_INFO[type].title,
        description: DOCUMENT_TYPE_INFO[type].description,
        templateKey: config.templateKey || null,
        sections: config.sections?.map(s => s.key) || null,
      };
    }),
    requiredFields: ['interactionId', 'facts', 'documents'],
    optionalFields: [
      'transcript',
      'patientInfo',
      'vetDiagnosis',
      'vetTreatmentPlan',
      'providerNotes',
      'evidenceFindings',
      'priorContext',
    ],
    exampleRequest: {
      interactionId: 'interaction-uuid',
      facts: [{ id: '1', text: 'Temperature 39.2 C', group: 'vitals', groupId: 'v1', isDiscarded: false, source: 'core', createdAt: '', createdAtTzOffset: null, updatedAt: '', updatedAtTzOffset: null, evidence: [] }],
      documents: ['soap-note', 'after-visit-summary'],
      patientInfo: { name: 'Jane Smith', age: '45 years', sex: 'female', weight: 68, weightUnit: 'kg' },
      diagnosis: 'Acute gastroenteritis',
      treatmentPlan: 'Clear liquids, bland diet, ondansetron PRN',
    },
  });
}
