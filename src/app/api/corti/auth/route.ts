import { NextResponse } from 'next/server';
import { isCortiConfigured } from '@/lib/env';

// Test Corti authentication
export async function GET() {
  try {
    if (!isCortiConfigured()) {
      return NextResponse.json(
        {
          status: 'not_configured',
          message: 'Corti environment variables not set. Please set CORTI_CLIENT_ID, CORTI_CLIENT_SECRET, and CORTI_TENANT.'
        },
        { status: 200 }
      );
    }

    const clientId = process.env.CORTI_CLIENT_ID!;
    const clientSecret = process.env.CORTI_CLIENT_SECRET!;
    const tenant = process.env.CORTI_TENANT!;
    const region = process.env.CORTI_ENV || 'eu';

    const authUrl = `https://auth.${region}.corti.app/realms/${tenant}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'openid',
    });

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { status: 'auth_failed', error: errorText },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: 'authenticated',
      region,
      tenant
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
