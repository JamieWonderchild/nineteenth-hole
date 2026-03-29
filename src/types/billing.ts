// Billing & Organization Types
// Multi-org architecture with Stripe billing

// ============================================================================
// PRICING TIERS
// ============================================================================

export type PlanTier = 'solo' | 'practice' | 'multi-location';

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  price: number; // Monthly price in USD
  includedSeats: number;
  extraSeatPrice: number | null; // null for solo (no extra seats)
  consultationLimit: number;
  companionLimit: number | null; // null = unlimited
  overageRate: number; // Per encounter beyond cap
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  solo: {
    tier: 'solo',
    name: 'Solo Provider',
    price: 79,
    includedSeats: 1,
    extraSeatPrice: null,
    consultationLimit: 150,
    companionLimit: 50,
    overageRate: 0.75,
    features: [
      'Voice-to-SOAP documentation',
      'Client summaries & discharge instructions',
      'Owner companion AI (50/mo)',
      'Follow-up tracking',
      '150 encounters/mo',
    ],
  },
  practice: {
    tier: 'practice',
    name: 'Practice',
    price: 149,
    includedSeats: 2,
    extraSeatPrice: 49,
    consultationLimit: 500,
    companionLimit: 200,
    overageRate: 0.50,
    features: [
      'Everything in Solo',
      '2 providers included (+$49/extra)',
      '500 encounters/mo',
      '200 companion sessions/mo',
      'Team management & roles',
      '14-day free trial',
    ],
  },
  'multi-location': {
    tier: 'multi-location',
    name: 'Multi-Location',
    price: 299,
    includedSeats: 5,
    extraSeatPrice: 39,
    consultationLimit: 2000,
    companionLimit: null,
    overageRate: 0.35,
    features: [
      'Everything in Practice',
      '5 providers included (+$39/extra)',
      '2,000 encounters/mo',
      'Unlimited companion sessions',
      'Multi-location support',
      'Priority support',
    ],
  },
};

// ============================================================================
// ORGANIZATION
// ============================================================================

export type BillingStatus =
  | 'trialing'
  | 'trial_expired'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete';

export type MemberRole = 'owner' | 'admin' | 'practice-admin' | 'provider';
export type MemberStatus = 'active' | 'pending' | 'deactivated';

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  clerkOrgId: string;
  // Billing
  plan: PlanTier;
  billingStatus: BillingStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: string;
  // Limits
  maxProviderSeats: number;
  // Clinic info
  clinicName?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  clinicAddress?: string;
  emergencyPhone?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  _id: string;
  orgId: string; // Convex org ID
  userId: string; // Clerk user ID
  role: MemberRole;
  status: MemberStatus;
  locationIds?: string[]; // Location assignment (null/empty = org-wide)
  invitedBy?: string;
  invitedAt?: string;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  _id: string;
  orgId: string;
  name: string;
  address?: string;
  phone?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

export type UsageType = 'encounter' | 'companion' | 'document';

export interface UsageRecord {
  _id: string;
  orgId: string;
  userId: string;
  type: UsageType;
  billingPeriodStart: string; // ISO date of billing period start
  createdAt: string;
}

export interface UsageSummary {
  encounters: number;
  companions: number;
  documents: number;
  consultationLimit: number;
  companionLimit: number | null;
  percentUsed: number;
}

// ============================================================================
// STRIPE INTEGRATION
// ============================================================================

export interface CheckoutRequest {
  plan: PlanTier;
  orgId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PortalRequest {
  orgId: string;
  returnUrl: string;
}

// ============================================================================
// ORG CONTEXT (used by useOrgContext hook)
// ============================================================================

export interface OrgContext {
  orgId: string; // Convex org _id
  clerkOrgId?: string;
  name: string;
  slug: string;
  plan: PlanTier;
  billingStatus: BillingStatus;
  stripeSubscriptionId?: string;
  role: MemberRole;
  maxProviderSeats: number;
  isOwner: boolean;
  isAdmin: boolean;
  canManageBilling: boolean;
  canManageTeam: boolean;
  canUseFeatures: boolean; // false if billing is canceled/unpaid
  assumedMode?: boolean; // true when superadmin is assuming this org
  assumedBy?: string; // superadmin's email
  // Multi-location support
  locationIds?: string[]; // User's assigned locations
  isLocationScoped: boolean; // True if practice admin or scoped provider
  accessibleLocationIds: string[] | null; // null = all, [...] = specific
}
