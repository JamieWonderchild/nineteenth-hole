import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

export const get = query({
  args: { memberId: v.id("clubMembers") },
  handler: async (ctx, { memberId }) => ctx.db.get(memberId),
});

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("clubMembers")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
  },
});

export const myActiveClubs = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();
    const active = memberships.filter(m => m.status === "active");
    const results = await Promise.all(
      active.map(async (m) => {
        const club = await ctx.db.get(m.clubId);
        return club ? { membership: m, club } : null;
      })
    );
    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const getByClubAndUser = query({
  args: { clubId: v.id("clubs"), userId: v.string() },
  handler: async (ctx, { clubId, userId }) => {
    return ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", userId))
      .unique();
  },
});

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_status", q => q.eq("clubId", clubId).eq("status", "active"))
      .collect();
  },
});

// All members (any status) — used by listNonMembers action
export const listAllForClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("clubMembers")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .collect();
  },
});

export const listPending = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_status", q => q.eq("clubId", clubId).eq("status", "pending"))
      .collect();
  },
});

// Leaderboard ordered by totalWon descending (active members only)
export const leaderboard = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const members = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_status", q => q.eq("clubId", clubId).eq("status", "active"))
      .collect();
    return members.sort((a, b) => b.totalWon - a.totalWon);
  },
});

// Creates a pending membership request if none exists
export const ensureMember = mutation({
  args: {
    clubId: v.id("clubs"),
    userId: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", args.clubId).eq("userId", args.userId))
      .unique();
    if (existing) return existing._id;

    const now = new Date().toISOString();
    return ctx.db.insert("clubMembers", {
      clubId: args.clubId,
      userId: args.userId,
      role: "member",
      status: "pending",
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      totalEntered: 0,
      totalSpent: 0,
      totalWon: 0,
      totalProfit: 0,
      joinedAt: now,
      updatedAt: now,
    });
  },
});

export const approveMember = mutation({
  args: { memberId: v.id("clubMembers") },
  handler: async (ctx, { memberId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");

    // Must be a club admin or super admin
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const caller = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", member.clubId).eq("userId", identity.subject))
        .unique();
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }

    await ctx.db.patch(memberId, { status: "active", updatedAt: new Date().toISOString() });
  },
});

export const rejectMember = mutation({
  args: { memberId: v.id("clubMembers") },
  handler: async (ctx, { memberId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");

    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const caller = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", member.clubId).eq("userId", identity.subject))
        .unique();
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }

    await ctx.db.delete(memberId);
  },
});

// Super admin hard-deletes a member record
export const deleteMember = mutation({
  args: { memberId: v.id("clubMembers") },
  handler: async (ctx, { memberId }) => {
    const identity = await ctx.auth.getUserIdentity();
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    if (!identity?.email || !superAdminEmails.includes(identity.email)) throw new Error("Not authorised");
    await ctx.db.delete(memberId);
  },
});

// Users who have entries but no club membership — for super admin assignment
export const listOrphans = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    if (!identity?.email || !superAdminEmails.includes(identity.email)) return [];

    const allEntries = await ctx.db.query("entries").collect();
    const allMembers = await ctx.db.query("clubMembers").collect();
    const memberUserIds = new Set(allMembers.map(m => m.userId));

    // Collect unique orphan users by userId
    const orphanMap = new Map<string, { userId: string; displayName: string; entryCount: number }>();
    for (const entry of allEntries) {
      if (!memberUserIds.has(entry.userId)) {
        const existing = orphanMap.get(entry.userId);
        if (existing) {
          existing.entryCount++;
        } else {
          orphanMap.set(entry.userId, {
            userId: entry.userId,
            displayName: entry.displayName,
            entryCount: 1,
          });
        }
      }
    }
    return Array.from(orphanMap.values());
  },
});

// Super admin assigns an orphan user to a club (creates active membership)
export const assignToClub = mutation({
  args: {
    userId: v.string(),
    clubId: v.id("clubs"),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    if (!identity?.email || !superAdminEmails.includes(identity.email)) throw new Error("Not authorised");

    const existing = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", args.clubId).eq("userId", args.userId))
      .unique();
    if (existing) {
      // Upgrade pending to active if needed
      if (existing.status !== "active") {
        await ctx.db.patch(existing._id, { status: "active", updatedAt: new Date().toISOString() });
      }
      return existing._id;
    }

    const now = new Date().toISOString();
    return ctx.db.insert("clubMembers", {
      clubId: args.clubId,
      userId: args.userId,
      role: "member",
      status: "active",
      displayName: args.displayName,
      totalEntered: 0,
      totalSpent: 0,
      totalWon: 0,
      totalProfit: 0,
      joinedAt: now,
      updatedAt: now,
    });
  },
});

// Called when a competition resolves — update cumulative stats
export const recordCompetitionResult = mutation({
  args: {
    clubId: v.id("clubs"),
    userId: v.string(),
    entryFee: v.number(),
    prizeWon: v.number(),
    leaderboardPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", args.clubId).eq("userId", args.userId))
      .unique();
    if (!member) return;

    const newTotalWon = member.totalWon + args.prizeWon;
    const newTotalSpent = member.totalSpent + args.entryFee;

    await ctx.db.patch(member._id, {
      totalEntered: member.totalEntered + 1,
      totalSpent: newTotalSpent,
      totalWon: newTotalWon,
      totalProfit: newTotalWon - newTotalSpent,
      bestFinish: member.bestFinish === undefined
        ? args.leaderboardPosition
        : Math.min(member.bestFinish, args.leaderboardPosition),
      updatedAt: new Date().toISOString(),
    });
  },
});

// Update a member's own directory profile
export const updateProfile = mutation({
  args: {
    clubId: v.id("clubs"),
    userId: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    bio: v.optional(v.string()),
    membershipCategory: v.optional(v.string()),
    directoryVisible: v.optional(v.boolean()),
    showPhone: v.optional(v.boolean()),
    showEmail: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) throw new Error("Unauthorised");

    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", args.clubId).eq("userId", args.userId))
      .unique();
    if (!member) throw new Error("Member not found");

    await ctx.db.patch(member._id, {
      phone: args.phone,
      email: args.email,
      bio: args.bio,
      membershipCategory: args.membershipCategory,
      directoryVisible: args.directoryVisible,
      showPhone: args.showPhone,
      showEmail: args.showEmail,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Admin sets a member's membership category
export const setMembershipCategory = mutation({
  args: { memberId: v.id("clubMembers"), membershipCategory: v.string() },
  handler: async (ctx, { memberId, membershipCategory }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");

    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const caller = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", member.clubId).eq("userId", identity.subject))
        .unique();
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }

    await ctx.db.patch(memberId, { membershipCategory, updatedAt: new Date().toISOString() });
  },
});

// Admin assigns a structured membership category to a member
export const setMembershipCategoryId = mutation({
  args: {
    memberId: v.id("clubMembers"),
    categoryId: v.optional(v.id("membershipCategories")),
  },
  handler: async (ctx, { memberId, categoryId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const caller = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", member.clubId).eq("userId", identity.subject))
        .unique();
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }
    // Also update the plain-text field for display
    let categoryName: string | undefined;
    if (categoryId) {
      const cat = await ctx.db.get(categoryId);
      categoryName = cat?.name;
    }
    await ctx.db.patch(memberId, {
      membershipCategoryId: categoryId,
      membershipCategory: categoryName,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const setRole = mutation({
  args: { memberId: v.id("clubMembers"), role: v.string() },
  handler: async (ctx, { memberId, role }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const member = await ctx.db.get(memberId);
      if (!member) throw new Error("Not found");
      const caller = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", member.clubId).eq("userId", identity.subject))
        .unique();
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }
    await ctx.db.patch(memberId, { role, updatedAt: new Date().toISOString() });
  },
});

export const setClubRoles = mutation({
  args: { memberId: v.id("clubMembers"), clubRoles: v.array(v.string()) },
  handler: async (ctx, { memberId, clubRoles }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const member = await ctx.db.get(memberId);
      if (!member) throw new Error("Not found");
      const caller = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", member.clubId).eq("userId", identity.subject))
        .unique();
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }
    await ctx.db.patch(memberId, { clubRoles, updatedAt: new Date().toISOString() });
  },
});

type ClerkUser = {
  id: string;
  first_name?: string;
  last_name?: string;
  email_addresses: Array<{ email_address: string }>;
};

async function fetchAllClerkUsers(): Promise<ClerkUser[]> {
  const res = await fetch(
    "https://api.clerk.com/v1/users?limit=500&order_by=-created_at",
    { headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` } }
  );
  if (!res.ok) throw new Error(`Clerk API error: ${res.status}`);
  return res.json();
}

// Super admin: list all Clerk users who are not already active members of this club
export const listNonMembers = action({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const identity = await ctx.auth.getUserIdentity();
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    if (!identity?.email || !superAdminEmails.includes(identity.email)) throw new Error("Not authorised");

    const [clerkUsers, allMembers] = await Promise.all([
      fetchAllClerkUsers(),
      ctx.runQuery(api.clubMembers.listAllForClub, { clubId }),
    ]);

    const memberUserIds = new Set((allMembers as Array<{ userId: string }>).map(m => m.userId));

    return clerkUsers
      .filter(u => !memberUserIds.has(u.id))
      .map(u => ({
        userId: u.id,
        displayName: [u.first_name, u.last_name].filter(Boolean).join(" ") || (u.email_addresses[0]?.email_address ?? u.id),
        email: u.email_addresses[0]?.email_address ?? "",
      }));
  },
});

// ── AI bulk member pre-registration ──────────────────────────────────────────

export const bulkPreRegister = mutation({
  args: {
    clubId: v.id("clubs"),
    members: v.array(v.object({
      displayName: v.string(),
      email: v.optional(v.string()),
      handicap: v.optional(v.number()),
      membershipCategory: v.optional(v.string()),
      phone: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { clubId, members }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const caller = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", identity.subject))
        .unique();
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }

    const now = new Date().toISOString();
    let created = 0;
    let skipped = 0;

    for (const m of members) {
      // Skip if a member with this email already exists in the club
      if (m.email) {
        const existing = await ctx.db
          .query("clubMembers")
          .withIndex("by_club", q => q.eq("clubId", clubId))
          .filter(q => q.eq(q.field("email"), m.email))
          .first();
        if (existing) { skipped++; continue; }
      }

      // Synthetic userId — replaced when the member redeems an invite and signs in
      const syntheticUserId = `pre_${Math.random().toString(36).slice(2)}_${Date.now()}`;

      await ctx.db.insert("clubMembers", {
        clubId,
        userId: syntheticUserId,
        displayName: m.displayName,
        email: m.email,
        phone: m.phone,
        handicap: m.handicap,
        membershipCategory: m.membershipCategory,
        role: "member",
        status: "active",
        totalEntered: 0,
        totalSpent: 0,
        totalWon: 0,
        totalProfit: 0,
        joinedAt: now,
        updatedAt: now,
      });
      created++;
    }

    return { created, skipped };
  },
});

// Super admin: add a known user (by userId) directly to a club
export const addMemberById = action({
  args: {
    userId: v.string(),
    clubId: v.id("clubs"),
    displayName: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, { userId, clubId, displayName, role }) => {
    const identity = await ctx.auth.getUserIdentity();
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    if (!identity?.email || !superAdminEmails.includes(identity.email)) throw new Error("Not authorised");

    const memberId = await ctx.runMutation(api.clubMembers.assignToClub, { userId, clubId, displayName });
    if (role === "admin") {
      await ctx.runMutation(api.clubMembers.setRole, { memberId: memberId as never, role: "admin" });
    }
    return memberId;
  },
});
