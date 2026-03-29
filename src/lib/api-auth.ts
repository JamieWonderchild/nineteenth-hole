import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Statuses that allow feature usage
const ACTIVE_STATUSES = ['active', 'trialing'];

export interface AuthResult {
  userId: string;
  orgId: string;        // Clerk org ID
  convexOrgId: string;  // Convex org _id
}

export interface AuthError {
  error: string;
  status: number;
}

/**
 * Verify the request is from an authenticated user with an active org billing status.
 * Returns the user/org context or an error.
 */
export async function requireActiveOrg(): Promise<AuthResult | AuthError> {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: 'Unauthorized', status: 401 };
  }

  const org = await convex.query(api.organizations.getByClerkOrg, {
    clerkOrgId: orgId,
  });

  if (!org) {
    return { error: 'Organization not found', status: 404 };
  }

  if (!ACTIVE_STATUSES.includes(org.billingStatus)) {
    // Check trial expiration as a fallback
    if (org.billingStatus === 'trialing' && org.trialEndsAt) {
      const expired = new Date(org.trialEndsAt) < new Date();
      if (expired) {
        return { error: 'Trial has expired. Please upgrade your plan.', status: 403 };
      }
    } else {
      return { error: `Billing inactive (${org.billingStatus}). Please update your subscription.`, status: 403 };
    }
  }

  return { userId, orgId, convexOrgId: org._id };
}

export function isAuthError(result: AuthResult | AuthError): result is AuthError {
  return 'error' in result;
}
