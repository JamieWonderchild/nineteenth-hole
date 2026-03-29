// Session verification utilities for onboarding flow
// Polls Clerk session until orgId appears after organization creation

import { debugLog } from './debug-logger';

export interface PollOptions {
  maxAttempts?: number;
  intervalMs?: number;
  timeoutMs?: number;
}

/**
 * Poll Clerk session until orgId appears after org creation
 * Replaces hardcoded 3-second wait with dynamic verification
 */
export async function pollForClerkSession(
  getSession: () => { orgId: string | null | undefined } | null,
  expectedOrgId: string,
  options: PollOptions = {}
): Promise<void> {
  const {
    maxAttempts = 33, // ~10 seconds at 300ms intervals
    intervalMs = 300,
    timeoutMs = 10000,
  } = options;

  const startTime = Date.now();
  let attempts = 0;

  debugLog.info('pollForClerkSession', 'Starting session poll', {
    expectedOrgId,
    maxAttempts,
    intervalMs,
  });

  while (attempts < maxAttempts) {
    const elapsed = Date.now() - startTime;

    // Check timeout
    if (elapsed >= timeoutMs) {
      debugLog.error('pollForClerkSession', 'Timeout waiting for session', {
        attempts,
        elapsed,
        expectedOrgId,
      });
      throw new Error(`Session verification timeout after ${elapsed}ms`);
    }

    // Get current session
    const session = getSession();
    const currentOrgId = session?.orgId;

    debugLog.debug('pollForClerkSession', 'Poll attempt', {
      attempt: attempts + 1,
      currentOrgId: currentOrgId || 'null',
      expectedOrgId,
      elapsed,
    });

    // Check if orgId matches
    if (currentOrgId === expectedOrgId) {
      debugLog.info('pollForClerkSession', 'Session verified successfully', {
        attempts: attempts + 1,
        elapsed,
        orgId: currentOrgId,
      });
      return;
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }

  // Max attempts reached
  debugLog.error('pollForClerkSession', 'Max attempts reached', {
    attempts,
    elapsed: Date.now() - startTime,
    expectedOrgId,
  });
  throw new Error(
    `Session verification failed after ${attempts} attempts (${Date.now() - startTime}ms)`
  );
}

/**
 * Simple delay utility for fallback cases
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
