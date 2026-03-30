// SMART on FHIR — Launch Route
// GET /api/fhir/launch?iss=...&launch=...
//
// This endpoint is hit when Epic (or the provider) initiates a SMART launch.
// It generates a PKCE verifier/challenge, stores state in a cookie, and
// redirects the browser to the Epic authorization endpoint.
//
// Two launch modes:
//   EHR-embedded: called by Epic with ?iss= and ?launch= params
//   Standalone:   provider clicks "Connect to Epic" — just ?iss= (or defaults to env var)

import { NextRequest, NextResponse } from 'next/server';
import { buildSmartAuthUrl, generateCodeVerifier } from '@/services/fhir-client';

export const runtime = 'nodejs';

const SCOPES = [
  'openid',
  'fhirUser',
  'launch',
  'patient/Patient.read',
  'patient/Encounter.read',
  'user/DocumentReference.write',
  'user/DocumentReference.read',
].join(' ');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const iss = searchParams.get('iss') || process.env.EPIC_FHIR_BASE_URL;
    const launch = searchParams.get('launch') ?? undefined;

    if (!iss) {
      return NextResponse.json(
        { error: 'Missing iss parameter and EPIC_FHIR_BASE_URL env var is not set.' },
        { status: 400 }
      );
    }

    const clientId = process.env.EPIC_CLIENT_ID;
    const redirectUri = process.env.EPIC_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'EPIC_CLIENT_ID and EPIC_REDIRECT_URI env vars must be set.' },
        { status: 503 }
      );
    }

    // Generate PKCE code verifier + random state
    const codeVerifier = generateCodeVerifier();
    const state = generateCodeVerifier(); // reuse same generator for random state

    // Build the Epic authorization URL
    const authUrl = await buildSmartAuthUrl({
      issuer: iss,
      clientId,
      redirectUri,
      scope: SCOPES,
      launch,
      codeVerifier,
      state,
    });

    // Store PKCE verifier, state, and issuer in secure cookies
    const response = NextResponse.redirect(authUrl);

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 600, // 10 minutes — enough time to complete the auth flow
      path: '/',
    };

    response.cookies.set('fhir_code_verifier', codeVerifier, cookieOpts);
    response.cookies.set('fhir_state', state, cookieOpts);
    response.cookies.set('fhir_iss', iss, cookieOpts);

    return response;
  } catch (error) {
    console.error('[fhir/launch] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initiate SMART launch',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
