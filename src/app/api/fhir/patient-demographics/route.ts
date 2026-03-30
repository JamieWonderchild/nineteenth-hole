// FHIR Patient Demographics
// GET /api/fhir/patient-demographics?patientId=xxx
//
// Pulls basic demographics from Epic for a connected provider session.
// Requires completed SMART OAuth flow (fhir_token + fhir_issuer cookies).

import { NextRequest, NextResponse } from 'next/server';
import { FhirClient } from '@/services/fhir-client';
import type { FhirTokenSet } from '@/services/fhir-client';
import { requireActiveOrg, isAuthError } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireActiveOrg();
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    if (!patientId) {
      return NextResponse.json({ error: 'Missing patientId' }, { status: 400 });
    }

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
    const demographics = await client.getPatientDemographics(patientId);

    return NextResponse.json(demographics);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch patient demographics';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
