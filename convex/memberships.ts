// convex/memberships.ts
// Organization membership management - roles, invites, access control
import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.string(),
    role: v.string(), // 'owner' | 'admin' | 'practice-admin' | 'provider'
    status: v.string(), // 'active' | 'pending'
    invitedBy: v.optional(v.string()),
    locationIds: v.optional(v.array(v.id("locations"))),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    // Check if membership already exists
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      // Reactivate if deactivated
      if (existing.status === "deactivated") {
        await ctx.db.patch(existing._id, {
          status: args.status,
          role: args.role,
          updatedAt: timestamp,
        });
        return existing._id;
      }
      throw new Error("User is already a member of this organization");
    }

    // Check seat limits
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    const activeMembers = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "active"),
            q.eq(q.field("status"), "pending")
          ),
          q.eq(q.field("archivedAt"), undefined) // Exclude archived
        )
      )
      .collect();

    if (activeMembers.length >= org.maxProviderSeats) {
      throw new Error(
        `Seat limit reached (${org.maxProviderSeats}). Upgrade your plan to add more providers.`
      );
    }

    return await ctx.db.insert("memberships", {
      orgId: args.orgId,
      userId: args.userId,
      role: args.role,
      status: args.status,
      locationIds: args.locationIds,
      invitedBy: args.invitedBy,
      invitedAt: args.status === "pending" ? timestamp : undefined,
      joinedAt: args.status === "active" ? timestamp : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

// Assign locations to a membership
export const assignLocations = mutation({
  args: {
    membershipId: v.id("memberships"),
    locationIds: v.array(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membership not found");

    // Verify locations belong to the same org
    for (const locId of args.locationIds) {
      const location = await ctx.db.get(locId);
      if (!location || location.orgId !== membership.orgId) {
        throw new Error("Invalid location");
      }
    }

    await ctx.db.patch(args.membershipId, {
      locationIds: args.locationIds,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Get members by organization and optionally by location
export const getByOrgAndLocation = query({
  args: {
    orgId: v.id("organizations"),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("archivedAt"), undefined) // Exclude archived
        )
      )
      .collect();

    if (!args.locationId) return memberships;

    // Filter to members assigned to this location or org-wide
    const locationId = args.locationId; // Type narrowing
    return memberships.filter(
      (m) =>
        !m.locationIds ||
        m.locationIds.length === 0 ||
        m.locationIds.includes(locationId)
    );
  },
});

export const getByOrgAndUser = query({
  args: {
    orgId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId)
      )
      .first();
  },
});

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "active"),
            q.eq(q.field("status"), "pending")
          ),
          q.eq(q.field("archivedAt"), undefined) // Exclude archived
        )
      )
      .collect();
  },
});

export const getByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// Enhanced query that returns memberships with user info from Clerk
export const getByOrgWithUserInfo = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Get provider names where they exist
    const providers = await ctx.db
      .query("providers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const vetNameMap: Record<string, { name: string; email: string }> = {};
    for (const provider of providers) {
      vetNameMap[provider.userId] = { name: provider.name, email: provider.email };
    }

    // Return memberships with user info
    return memberships.map((m) => ({
      ...m,
      userName: vetNameMap[m.userId]?.name,
      userEmail: vetNameMap[m.userId]?.email,
    }));
  },
});

export const getActiveByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("archivedAt"), undefined) // Exclude archived
        )
      )
      .collect();
  },
});

// Accept a pending invite
export const acceptInvite = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId)
      )
      .first();

    if (!membership) throw new Error("Membership not found");
    if (membership.status !== "pending") {
      throw new Error("Invite is not pending");
    }

    const timestamp = new Date().toISOString();
    await ctx.db.patch(membership._id, {
      status: "active",
      joinedAt: timestamp,
      updatedAt: timestamp,
    });

    return { success: true };
  },
});

export const updateRole = mutation({
  args: {
    membershipId: v.id("memberships"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membership not found");

    // Prevent demoting the last owner
    if (membership.role === "owner" && args.role !== "owner") {
      const owners = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", membership.orgId))
        .filter((q) =>
          q.and(
            q.eq(q.field("role"), "owner"),
            q.eq(q.field("status"), "active")
          )
        )
        .collect();

      if (owners.length <= 1) {
        throw new Error("Cannot remove the last owner");
      }
    }

    await ctx.db.patch(args.membershipId, {
      role: args.role,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Mutation - deactivate in Convex (can be called by webhook or action)
export const deactivate = mutation({
  args: {
    membershipId: v.id("memberships"),
    fromClerk: v.optional(v.boolean()), // True if called from webhook (skip Clerk sync)
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membership not found");

    // Prevent deactivating the last owner
    if (membership.role === "owner") {
      const owners = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", membership.orgId))
        .filter((q) =>
          q.and(
            q.eq(q.field("role"), "owner"),
            q.eq(q.field("status"), "active")
          )
        )
        .collect();

      if (owners.length <= 1) {
        throw new Error("Cannot deactivate the last owner");
      }
    }

    await ctx.db.patch(args.membershipId, {
      status: "deactivated",
      updatedAt: new Date().toISOString(),
    });
  },
});

// Action - deactivate with Clerk sync (removes from BOTH Clerk and Convex)
export const deactivateWithClerkSync = action({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, args) => {
    // Import api for queries
    const { api } = await import("./_generated/api");

    // Get membership details first
    const membership = await ctx.runQuery(
      api.memberships.getMembershipForAction,
      { membershipId: args.membershipId }
    );

    if (!membership) throw new Error("Membership not found");

    // Get org to retrieve clerkOrgId
    const org = await ctx.runQuery(
      api.memberships.getOrgForAction,
      { orgId: membership.orgId }
    );

    if (!org?.clerkOrgId) {
      throw new Error("Organization not found or missing Clerk ID");
    }

    // Step 1: Remove from Clerk
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    try {
      const response = await fetch(
        `https://api.clerk.com/v1/organizations/${org.clerkOrgId}/memberships/${membership.userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to remove from Clerk:", errorText);
        throw new Error(`Failed to remove from Clerk: ${response.status}`);
      }

      console.log(`Removed user ${membership.userId} from Clerk org ${org.clerkOrgId}`);
    } catch (error) {
      console.error("Error removing from Clerk:", error);
      throw error;
    }

    // Step 2: Deactivate in Convex
    // The webhook will handle this automatically, but we'll do it here for immediate effect
    await ctx.runMutation(api.memberships.deactivate, {
      membershipId: args.membershipId,
      fromClerk: true, // Skip Clerk sync since we just did it
    });

    return { success: true };
  },
});

// Helper queries for action (internal to prevent external access)
export const getMembershipForAction = query({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.membershipId);
  },
});

export const getOrgForAction = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orgId);
  },
});

// Count active seats for billing
export const countActiveSeats = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "active"),
            q.eq(q.field("status"), "pending")
          ),
          q.eq(q.field("archivedAt"), undefined) // Exclude archived
        )
      )
      .collect();

    return members.length;
  },
});

// Update lastSeenAt for first-login detection
export const updateLastSeen = mutation({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membership not found");

    await ctx.db.patch(args.membershipId, {
      lastSeenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

// Get all memberships for admin (no auth check - called by admin actions)
export const getAllForAdmin = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("memberships").collect();
  },
});
