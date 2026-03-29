// Stripe Configuration Validation
// Ensures all required Stripe environment variables are present.
// Call validateStripeConfig() at app startup or in API routes to catch
// missing configuration early.

export interface StripeConfigStatus {
  isConfigured: boolean;
  mode: 'live' | 'test' | 'unknown';
  missing: string[];
  warnings: string[];
}

const REQUIRED_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_SOLO',
  'STRIPE_PRICE_PRACTICE',
  'STRIPE_PRICE_MULTI',
] as const;

const OPTIONAL_VARS = [
  'STRIPE_PRICE_EXTRA_SEAT_PRACTICE',
  'STRIPE_PRICE_EXTRA_SEAT_MULTI',
] as const;

export function validateStripeConfig(): StripeConfigStatus {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const v of REQUIRED_VARS) {
    if (!process.env[v]) {
      missing.push(v);
    }
  }

  for (const v of OPTIONAL_VARS) {
    if (!process.env[v]) {
      warnings.push(`${v} is not set - extra seat billing will not work for this plan`);
    }
  }

  // Detect mode from key prefix
  const key = process.env.STRIPE_SECRET_KEY || '';
  let mode: 'live' | 'test' | 'unknown' = 'unknown';
  if (key.startsWith('sk_live_')) {
    mode = 'live';
  } else if (key.startsWith('sk_test_')) {
    mode = 'test';
  }

  // Warn if mixing test keys with live price IDs or vice versa
  if (mode === 'live') {
    const priceVars = [
      'STRIPE_PRICE_SOLO',
      'STRIPE_PRICE_PRACTICE',
      'STRIPE_PRICE_MULTI',
      'STRIPE_PRICE_EXTRA_SEAT_PRACTICE',
      'STRIPE_PRICE_EXTRA_SEAT_MULTI',
    ];
    for (const pv of priceVars) {
      const val = process.env[pv];
      if (val && val.includes('test')) {
        warnings.push(`${pv} appears to be a test price ID but STRIPE_SECRET_KEY is a live key`);
      }
    }
  } else if (mode === 'test') {
    // No warning needed for test mode - that's expected in dev
  }

  return {
    isConfigured: missing.length === 0,
    mode,
    missing,
    warnings,
  };
}
