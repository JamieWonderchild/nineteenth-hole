import { NextResponse } from 'next/server';
import { logError } from '@/lib/errorLogger';
import { auth } from '@clerk/nextjs/server';

// This endpoint returns the WebSocket connection details for streaming
// The actual WebSocket connection is made from the client directly to Corti's API
export async function POST() {
  const { userId, orgId } = await auth();

  try {
    const clientId = process.env.CORTI_CLIENT_ID;
    const clientSecret = process.env.CORTI_CLIENT_SECRET;
    const tenant = process.env.CORTI_TENANT;
    const region = process.env.CORTI_ENV || 'eu';

    if (!clientId || !clientSecret || !tenant) {
      return NextResponse.json(
        { error: 'Missing Corti credentials. Please set CORTI_CLIENT_ID, CORTI_CLIENT_SECRET, and CORTI_TENANT environment variables.' },
        { status: 500 }
      );
    }

    // Get auth token
    const authUrl = `https://auth.${region}.corti.app/realms/${tenant}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'openid',
    });

    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();

      await logError({
        category: 'corti-auth',
        severity: 'error',
        message: `Corti authentication failed: ${errorText}`,
        endpoint: '/api/corti/stream',
        userId: userId || undefined,
        orgId: orgId || undefined,
        metadata: { authUrl, status: authResponse.status },
      });

      return NextResponse.json(
        { error: `Authentication failed: ${errorText}` },
        { status: 401 }
      );
    }

    const authData = await authResponse.json();

    // Create an interaction for this streaming session
    const interactionResponse = await fetch(
      `https://api.${region}.corti.app/v2/interactions/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json',
          'Tenant-Name': tenant,
        },
        body: JSON.stringify({
          encounter: {
            identifier: `provider-encounter-${Date.now()}`,
            status: 'in-progress',
            type: 'encounter',
            period: { startedAt: new Date().toISOString() },
          },
        }),
      }
    );

    if (!interactionResponse.ok) {
      const errorText = await interactionResponse.text();

      await logError({
        category: 'corti-stream',
        severity: 'error',
        message: `Failed to create Corti interaction: ${errorText}`,
        endpoint: '/api/corti/stream',
        userId: userId || undefined,
        orgId: orgId || undefined,
        metadata: {
          status: interactionResponse.status,
          url: `https://api.${region}.corti.app/v2/interactions/`
        },
      });

      return NextResponse.json(
        { error: `Failed to create interaction: ${errorText}` },
        { status: 500 }
      );
    }

    const interaction = await interactionResponse.json();

    // Use the websocketUrl from the API response and append token with "Bearer " prefix
    // Per docs: "Append a token in the format: ?token=Bearer token-value-here"
    let wsUrl = interaction.websocketUrl;
    if (!wsUrl) {
      wsUrl = `wss://api.${region}.corti.app/audio-bridge/v2/interactions/${interaction.interactionId}/streams?tenant-name=${tenant}`;
    }
    const separator = wsUrl.includes('?') ? '&' : '?';
    wsUrl = `${wsUrl}${separator}token=Bearer%20${authData.access_token}`;

    return NextResponse.json({
      token: authData.access_token,
      interactionId: interaction.interactionId,
      wsUrl,
      tenant,
      region,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    await logError({
      category: 'corti-stream',
      severity: 'error',
      message: `Corti stream initialization failed: ${message}`,
      error: error instanceof Error ? error : undefined,
      endpoint: '/api/corti/stream',
      userId: userId || undefined,
      orgId: orgId || undefined,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
