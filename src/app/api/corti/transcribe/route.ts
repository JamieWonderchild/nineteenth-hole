import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const maxDuration = 60;

// Returns WSS URL + token for the /transcribe WebSocket endpoint.
// Client connects directly — same pattern as /api/corti/stream.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.CORTI_CLIENT_ID;
  const clientSecret = process.env.CORTI_CLIENT_SECRET;
  const tenant = process.env.CORTI_TENANT;
  const region = process.env.CORTI_ENV || 'eu';

  if (!clientId || !clientSecret || !tenant) {
    return NextResponse.json({ error: 'Missing Corti credentials' }, { status: 500 });
  }

  const authUrl = `https://auth.${region}.corti.app/realms/${tenant}/protocol/openid-connect/token`;
  const authResponse = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'openid',
    }).toString(),
  });

  if (!authResponse.ok) {
    const errorText = await authResponse.text();
    return NextResponse.json({ error: `Auth failed: ${errorText}` }, { status: 401 });
  }

  const { access_token } = await authResponse.json();

  return NextResponse.json({ accessToken: access_token, tenantName: tenant, environment: region });
}
