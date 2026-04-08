import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

async function assertClubAdminOrSuperAdmin(
  ctx: Parameters<Parameters<typeof mutation>[0]["handler"]>[0],
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

export const getBySlug = query({
  args: { clubId: v.id("clubs"), slug: v.string() },
  handler: async (ctx, { clubId, slug }) => {
    return ctx.db
      .query("competitions")
      .withIndex("by_club_and_slug", q => q.eq("clubId", clubId).eq("slug", slug))
      .unique();
  },
});

export const get = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    return ctx.db.get(competitionId);
  },
});

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
    await assertClubAdminOrSuperAdmin(ctx, comp.clubId);
    await ctx.db.patch(competitionId, { status, updatedAt: new Date().toISOString() });
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

export const markDrawComplete = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const comp = await ctx.db.get(competitionId);
    if (!comp) throw new Error("Competition not found");
    await assertClubAdminOrSuperAdmin(ctx, comp.clubId);
    await ctx.db.patch(competitionId, {
      drawCompletedAt: new Date().toISOString(),
      status: "live",
      updatedAt: new Date().toISOString(),
    });
  },
});
