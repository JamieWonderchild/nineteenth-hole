// Debug queries for investigating database state
import { query } from "./_generated/server";

// List all providers with their userId
export const listAllVets = query({
  handler: async (ctx) => {
    const providers = await ctx.db.query("providers").collect();
    return providers.map(v => ({
      id: v._id,
      userId: v.userId,
      name: v.name,
      email: v.email,
      orgId: v.orgId,
      isActive: v.isActive,
    }));
  },
});

// List all memberships
export const listAllMemberships = query({
  handler: async (ctx) => {
    const memberships = await ctx.db.query("memberships").collect();
    return memberships.map(m => ({
      id: m._id,
      userId: m.userId,
      orgId: m.orgId,
      role: m.role,
      status: m.status,
      locationIds: m.locationIds,
      joinedAt: m.joinedAt,
      invitedAt: m.invitedAt,
    }));
  },
});

// List all organizations
export const listAllOrgs = query({
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    return orgs.map(o => ({
      id: o._id,
      name: o.name,
      slug: o.slug,
      clerkOrgId: o.clerkOrgId,
      plan: o.plan,
    }));
  },
});

// List all invitations
export const listAllInvitations = query({
  handler: async (ctx) => {
    const invitations = await ctx.db.query("invitations").collect();
    return invitations.map(i => ({
      id: i._id,
      orgId: i.orgId,
      email: i.email,
      role: i.role,
      status: i.status,
      invitedBy: i.invitedBy,
      acceptedBy: i.acceptedBy,
      acceptedAt: i.acceptedAt,
      createdAt: i.createdAt,
    }));
  },
});

// Get provider-membership correlation
export const getVetMembershipCorrelation = query({
  handler: async (ctx) => {
    const providers = await ctx.db.query("providers").collect();
    const memberships = await ctx.db.query("memberships").collect();

    const vetUserIds = new Set(providers.map(v => v.userId));
    const memberUserIds = new Set(memberships.map(m => m.userId));

    const membersWithoutVetRecord = [...memberUserIds].filter(uid => !vetUserIds.has(uid));
    const vetsWithoutMembership = [...vetUserIds].filter(uid => !memberUserIds.has(uid));

    return {
      totalVets: providers.length,
      totalMemberships: memberships.length,
      membersWithoutVetRecord,
      vetsWithoutMembership,
      correlation: memberships.map(m => ({
        userId: m.userId,
        role: m.role,
        status: m.status,
        hasVetRecord: vetUserIds.has(m.userId),
      })),
    };
  },
});
