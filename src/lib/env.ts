import { z } from 'zod';

const envSchema = z.object({
  CORTI_CLIENT_ID: z.string().min(1, 'CORTI_CLIENT_ID is required'),
  CORTI_CLIENT_SECRET: z.string().min(1, 'CORTI_CLIENT_SECRET is required'),
  CORTI_ENV: z.enum(['eu', 'us']).default('eu'),
  CORTI_TENANT: z.string().min(1, 'CORTI_TENANT is required').transform(s => s.trim()),
});

type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Corti environment validation failed:');
    console.error(result.error.format());
    throw new Error('Missing or invalid Corti environment variables');
  }

  return result.data;
}

// Lazy initialization - only validates when accessed
let _env: Env | null = null;

export function env(): Env {
  if (!_env) {
    _env = getEnv();
  }
  return _env;
}

// Check if Corti env vars are configured (without throwing)
export function isCortiConfigured(): boolean {
  return !!(
    process.env.CORTI_CLIENT_ID &&
    process.env.CORTI_CLIENT_SECRET &&
    process.env.CORTI_TENANT
  );
}

// Computed URLs based on environment
export function getAuthUrl(tenant: string, region: string = 'eu'): string {
  return `https://auth.${region}.corti.app/realms/${tenant}/protocol/openid-connect/token`;
}

export function getApiBaseUrl(region: string = 'eu'): string {
  return `https://api.${region}.corti.app`;
}

export function getWsBaseUrl(region: string = 'eu'): string {
  return `wss://api.${region}.corti.app`;
}
