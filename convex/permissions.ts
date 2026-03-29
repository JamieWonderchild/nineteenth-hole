// Permission utilities for multi-location architecture
// Handles role-based access control and location scoping

import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// Super Admin
// ============================================================================

/**
 * Check if email is a super admin
 * Super admins can assume any org and override billing
 */
export function isSuperadmin(email?: string): boolean {
  if (!email) return false;
  const superadmins = (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return superadmins.includes(email.toLowerCase());
}

/**
 * Require caller to be a super admin
 * Throws error if not authorized
 */
export function assertSuperadmin(email: string) {
  if (!isSuperadmin(email)) {
    throw new Error("Forbidden: not a superadmin");
  }
}

// ============================================================================
// Membership Access
// ============================================================================

/**
 * Get user's membership in an organization
 */
export async function getUserMembership(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  orgId: Id<"organizations">
) {
  return await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .first();
}

/**
 * Require user to have active membership in organization
 * Returns the membership if valid, throws error otherwise
 */
export async function requireOrgAccess(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  orgId: Id<"organizations">
) {
  const membership = await getUserMembership(ctx, userId, orgId);
  if (!membership || membership.status !== "active") {
    throw new Error("Access denied: not a member of this organization");
  }
  return membership;
}

// ============================================================================
// Location Access
// ============================================================================

/**
 * Get user's accessible location IDs
 * Returns:
 * - null: user can access all locations (owner, org-wide admin)
 * - []: user has no location access
 * - [...]: user can access specific locations (practice admin, scoped provider)
 */
export async function getUserAccessibleLocationIds(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  orgId: Id<"organizations">
): Promise<Id<"locations">[] | null> {
  const membership = await getUserMembership(ctx, userId, orgId);
  if (!membership) return [];

  // Owner and org-wide admin see all locations
  if (membership.role === "owner" || membership.role === "admin") {
    if (!membership.locationIds || membership.locationIds.length === 0) {
      return null; // null = all locations
    }
  }

  // Practice admin and providers see only assigned locations
  if (membership.role === "practice-admin" || membership.role === "provider") {
    return membership.locationIds || [];
  }

  return [];
}

/**
 * Require user to have access to a specific location
 * Throws error if access denied
 */
export async function requireLocationAccess(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  locationId: Id<"locations">
) {
  const location = await ctx.db.get(locationId);
  if (!location) throw new Error("Location not found");

  const accessibleIds = await getUserAccessibleLocationIds(
    ctx,
    userId,
    location.orgId
  );

  // null = all locations
  if (accessibleIds === null) return;

  // Check if location is in accessible list
  if (!accessibleIds.includes(locationId)) {
    throw new Error("Access denied: cannot access this location");
  }
}

// ============================================================================
// Permission Checks
// ============================================================================

/**
 * Check if user can manage team members
 * Owners, admins, and practice admins can manage team
 */
export function canManageTeam(membership: {
  role: string;
  status: string;
}): boolean {
  if (membership.status !== "active") return false;
  return ["owner", "admin", "practice-admin"].includes(membership.role);
}

/**
 * Check if user can manage billing
 * Only organization owners can manage billing
 */
export function canManageBilling(membership: {
  role: string;
  status: string;
}): boolean {
  if (membership.status !== "active") return false;
  return membership.role === "owner";
}

/**
 * Check if user is location-scoped
 * Practice admins and providers with location assignments are scoped
 */
export function isLocationScoped(membership: {
  role: string;
  locationIds?: Id<"locations">[];
}): boolean {
  return (
    membership.role === "practice-admin" ||
    (membership.role === "provider" &&
      !!membership.locationIds &&
      membership.locationIds.length > 0)
  );
}

/**
 * Check if user can access a specific location
 */
export function canAccessLocation(
  membership: {
    role: string;
    locationIds?: Id<"locations">[];
  },
  locationId: Id<"locations">
): boolean {
  // Owner/org-wide admin can access all
  if (membership.role === "owner" || membership.role === "admin") {
    if (!membership.locationIds || membership.locationIds.length === 0) {
      return true;
    }
  }

  // Check if location in assigned list
  return membership.locationIds?.includes(locationId) || false;
}

/**
 * Check if user has org-wide access (not location-scoped)
 */
export function hasOrgWideAccess(membership: {
  role: string;
  locationIds?: Id<"locations">[];
}): boolean {
  if (membership.role === "owner" || membership.role === "admin") {
    return !membership.locationIds || membership.locationIds.length === 0;
  }
  return false;
}

// ============================================================================
// Patient Management Permissions
// ============================================================================

/**
 * Check if user can create/edit patients
 * All active members (owner, admin, practice-admin, provider) can manage patients
 */
export function canManagePatients(membership: {
  role: string;
  status: string;
}): boolean {
  if (membership.status !== "active") return false;
  return ["owner", "admin", "practice-admin", "provider"].includes(membership.role);
}

/**
 * Require user to have patient management access
 * Throws error if access denied
 */
export async function requirePatientAccess(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  orgId: Id<"organizations">
) {
  const membership = await requireOrgAccess(ctx, userId, orgId);
  if (!canManagePatients(membership)) {
    throw new Error("Access denied: insufficient permissions to manage patients");
  }
  return membership;
}
