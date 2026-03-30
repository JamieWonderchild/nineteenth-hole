// FHIR Push Note
// POST /api/fhir/push-note
//
// Pushes a clinical note as a FHIR DocumentReference to the connected EHR (Epic).
// Requires the provider to have completed the SMART OAuth flow first.

import { NextRequest, NextResponse } from 'next/server';
import { FhirClient, buildDocumentReference } from '@/services/fhir-client';
import type { FhirTokenSet } from '@/services/fhir-client';
import { requireActiveOrg, isAuthError } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await requireActiveOrg();
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Read FHIR session from cookie
    const tokenB64 = request.cookies.get('fhir_token')?.value;
    const issuer = request.cookies.get('fhir_issuer')?.value;

    if (!tokenB64 || !issuer) {
      return NextResponse.json(
        { error: 'Not connected to Epic. Please complete the SMART OAuth flow first.' },
        { status: 401 }
      );
    }

    let tokenSet: FhirTokenSet;
    try {
      tokenSet = JSON.parse(Buffer.from(tokenB64, 'base64').toString('utf8')) as FhirTokenSet;
    } catch {
      return NextResponse.json({ error: 'Invalid FHIR session. Please reconnect.' }, { status: 401 });
    }

    const client = new FhirClient(issuer, tokenSet);

    if (client.isTokenExpired()) {
      return NextResponse.json(
        { error: 'Epic session expired. Please reconnect.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      patientFhirId,
      encounterFhirId,
      docTitle,
      noteText,
      loincCode,
    } = body as {
      patientFhirId: string;
      encounterFhirId?: string;
      docTitle: string;
      noteText: string;
      loincCode?: string;
    };

    if (!patientFhirId || !docTitle || !noteText) {
      return NextResponse.json(
        { error: 'patientFhirId, docTitle, and noteText are required' },
        { status: 400 }
      );
    }

    const docRef = buildDocumentReference({
      patientFhirId,
      encounterFhirId,
      docTitle,
      noteText,
      loincCode,
    });

    const result = await client.pushNote(docRef);

    return NextResponse.json({ success: true, documentReferenceId: result.id });
  } catch (error) {
    console.error('[fhir/push-note] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to push note to Epic',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
