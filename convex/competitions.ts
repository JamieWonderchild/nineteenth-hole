import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";

async function assertClubAdminOrSuperAdmin(
  ctx: MutationCtx,
  clubId: import("./_generated/dataModel").Id<"clubs">
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return;

  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", identity.subject))
    .unique();
  if (!member || member.role !== "admin") throw new Error("Not authorised");
}

async function assertSuperAdmin(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (!identity.email || !superAdminEmails.includes(identity.email)) throw new Error("Not authorised");
}

// ── Queries ─────────────────────────────────────────────────────────────────

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("competitions")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .order("desc")
      .collect();
  },
});

// All platform-wide pools (scope = 'platform')
export const listPlatform = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("competitions")
      .withIndex("by_scope", q => q.eq("scope", "platform"))
      .order("desc")
      .collect();
  },
});

// Platform pools that are open or live (for the home page banner)
export const listPlatformActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("competitions")
      .withIndex("by_scope", q => q.eq("scope", "platform"))
      .collect();
    return all.filter(c => c.status === "open" || c.status === "live");
  },
});

export const getBySlug = query({
  args: { clubId: v.id("clubs"), slug: v.string() },
  handler: async (ctx, { clubId, slug }) => {
    return ctx.db
      .query("competitions")
      .withIndex("by_club_and_slug", q => q.eq("clubId", clubId).eq("slug", slug))
      .unique();
  },
});

// Global slug lookup — for platform pools (no clubId)
export const getByPlatformSlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const results = await ctx.db
      .query("competitions")
      .withIndex("by_slug", q => q.eq("slug", slug))
      .collect();
    return results.find(c => c.scope === "platform") ?? null;
  },
});

export const get = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    return ctx.db.get(competitionId);
  },
});

export const listLive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("competitions")
      .withIndex("by_status", q => q.eq("status", "live"))
      .collect();
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

// Create a club-scoped competition (club admin only)
export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    type: v.string(),
    tournamentRef: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    entryDeadline: v.string(),
    drawType: v.string(),
    tierCount: v.number(),
    playersPerTier: v.number(),
    entryFee: v.number(),
    currency: v.string(),
    prizeStructure: v.array(v.object({
      position: v.number(),
      percentage: v.number(),
    })),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    await assertClubAdminOrSuperAdmin(ctx, args.clubId);

    const existing = await ctx.db
      .query("competitions")
      .withIndex("by_club_and_slug", q => q.eq("clubId", args.clubId).eq("slug", args.slug))
      .unique();
    if (existing) throw new Error(`Slug "${args.slug}" already exists in this club`);

    const now = new Date().toISOString();
    return ctx.db.insert("competitions", {
      ...args,
      scope: "club",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Create a platform-wide tour pool (super admin only)
export const createPlatformPool = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    type: v.string(),
    tournamentRef: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    entryDeadline: v.string(),
    drawType: v.string(),
    tierCount: v.number(),
    playersPerTier: v.number(),
    entryFee: v.number(),
    currency: v.string(),
    prizeStructure: v.array(v.object({
      position: v.number(),
      percentage: v.number(),
    })),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    await assertSuperAdmin(ctx);

    // Global slug uniqueness check
    const existing = await ctx.db
      .query("competitions")
      .withIndex("by_slug", q => q.eq("slug", args.slug))
      .collect();
    if (existing.some(c => c.scope === "platform")) {
      throw new Error(`Platform pool with slug "${args.slug}" already exists`);
    }

    const now = new Date().toISOString();
    return ctx.db.insert("competitions", {
      ...args,
      scope: "platform",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
    competitionId: v.id("competitions"),
    status: v.string(),
  },
  handler: async (ctx, { competitionId, status }) => {
    const comp = await ctx.db.get(competitionId);
    if (!comp) throw new Error("Competition not found");

    if (comp.scope === "platform") {
      await assertSuperAdmin(ctx);
    } else if (comp.clubId) {
      await assertClubAdminOrSuperAdmin(ctx, comp.clubId);
    } else {
      await assertSuperAdmin(ctx);
    }

    await ctx.db.patch(competitionId, { status, updatedAt: new Date().toISOString() });
  },
});

export const markDrawComplete = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const comp = await ctx.db.get(competitionId);
    if (!comp) throw new Error("Competition not found");

    if (comp.scope === "platform") {
      await assertSuperAdmin(ctx);
    } else if (comp.clubId) {
      await assertClubAdminOrSuperAdmin(ctx, comp.clubId);
    } else {
      await assertSuperAdmin(ctx);
    }

    await ctx.db.patch(competitionId, {
      drawCompletedAt: new Date().toISOString(),
      status: "live",
      updatedAt: new Date().toISOString(),
    });
  },
});
