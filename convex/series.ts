import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";

async function assertClubAdmin(
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

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("series")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    return ctx.db.get(seriesId);
  },
});

export const getCompetitions = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    const links = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", seriesId))
      .collect();
    const comps = await Promise.all(links.map(l => ctx.db.get(l.competitionId)));
    return comps.filter(Boolean);
  },
});

export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    description: v.optional(v.string()),
    season: v.string(),
    pointsStructure: v.array(v.object({
      position: v.number(),
      points: v.number(),
    })),
    prizePool: v.optional(v.number()),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    await assertClubAdmin(ctx, args.clubId);
    const identity = await ctx.auth.getUserIdentity();
    const now = new Date().toISOString();
    return ctx.db.insert("series", {
      ...args,
      status: "active",
      createdBy: identity!.subject,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addCompetition = mutation({
  args: {
    seriesId: v.id("series"),
    competitionId: v.id("competitions"),
    weight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.seriesId);
    if (!series) throw new Error("Series not found");
    await assertClubAdmin(ctx, series.clubId);

    const existing = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", args.seriesId))
      .collect();
    if (existing.some(e => e.competitionId === args.competitionId)) return;

    await ctx.db.insert("seriesCompetitions", {
      seriesId: args.seriesId,
      competitionId: args.competitionId,
      weight: args.weight,
      addedAt: new Date().toISOString(),
    });
  },
});
