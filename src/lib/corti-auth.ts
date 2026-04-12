export async function fetchCortiToken(
  authUrl: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number; token_type: string }> {
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
    throw new Error(`Corti auth failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export function getCortiAuthUrl(tenant: string, region = 'eu'): string {
  return `https://auth.${region}.corti.app/realms/${tenant}/protocol/openid-connect/token`;
}

export function getCortiApiUrl(region = 'eu'): string {
  return `https://api.${region}.corti.app`;
}
