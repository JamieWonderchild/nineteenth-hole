// SMART on FHIR — OAuth Callback
// GET /api/fhir/callback?code=...&state=...
//
// Called by Epic after the provider authenticates.
// Exchanges the authorization code for tokens, stores them in a session cookie,
// and redirects back to the document that triggered the launch.

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/services/fhir-client';
import type { FhirTokenSet } from '@/services/fhir-client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const returnedState = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle Epic errors (user denied, etc.)
    if (error) {
      const desc = searchParams.get('error_description') ?? error;
      return NextResponse.redirect(
        new URL(`/fhir-launch?error=${encodeURIComponent(desc)}`, request.url)
      );
    }

    if (!code || !returnedState) {
      return NextResponse.redirect(
        new URL('/fhir-launch?error=Missing+authorization+code', request.url)
      );
    }

    // Read PKCE state from cookie
    const storedState = request.cookies.get('fhir_state')?.value;
    const codeVerifier = request.cookies.get('fhir_code_verifier')?.value;
    const issuer = request.cookies.get('fhir_iss')?.value;

    if (!storedState || storedState !== returnedState) {
      return NextResponse.redirect(
        new URL('/fhir-launch?error=State+mismatch+%28possible+CSRF%29', request.url)
      );
    }

    if (!codeVerifier || !issuer) {
      return NextResponse.redirect(
        new URL('/fhir-launch?error=Session+expired', request.url)
      );
    }

    const clientId = process.env.EPIC_CLIENT_ID!;
    const redirectUri = process.env.EPIC_REDIRECT_URI!;

    const tokenSet = await exchangeCodeForTokens({
      issuer,
      clientId,
      redirectUri,
      code,
      codeVerifier,
    });

    // Store tokens in a session cookie (HttpOnly, 8-hour lifetime)
    const tokenJson = JSON.stringify(tokenSet);
    const tokenB64 = Buffer.from(tokenJson).toString('base64');

    const redirectUrl = new URL('/fhir-launch?connected=1', request.url);
    if (tokenSet.patient) {
      redirectUrl.searchParams.set('patient', tokenSet.patient);
    }
    if (tokenSet.encounter) {
      redirectUrl.searchParams.set('encounter', tokenSet.encounter);
    }

    const response = NextResponse.redirect(redirectUrl);

    // Clear the PKCE cookies
    const clearOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 };
    response.cookies.set('fhir_code_verifier', '', clearOpts);
    response.cookies.set('fhir_state', '', clearOpts);
    response.cookies.set('fhir_iss', '', clearOpts);

    // Store token + issuer
    const sessionOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    };
    response.cookies.set('fhir_token', tokenB64, sessionOpts);
    response.cookies.set('fhir_issuer', issuer, sessionOpts);

    return response;
  } catch (error) {
    console.error('[fhir/callback] Error:', error);
    const msg = error instanceof Error ? error.message : 'Token exchange failed';
    return NextResponse.redirect(
      new URL(`/fhir-launch?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
