import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function assertAdmin(ctx: MutationCtx, clubId: Id<"clubs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",").map((e) => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return;
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", (q) =>
      q.eq("clubId", clubId).eq("userId", identity.subject)
    )
    .unique();
  if (!member || member.role !== "admin") throw new Error("Not authorised");
}

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("posTerminals")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();
  },
});

export const save = mutation({
  args: {
    clubId: v.id("clubs"),
    terminalDbId: v.optional(v.id("posTerminals")),
    provider: v.string(),
    terminalId: v.string(),
    name: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, { clubId, terminalDbId, provider, terminalId, name, isActive }) => {
    await assertAdmin(ctx, clubId);
    if (terminalDbId) {
      await ctx.db.patch(terminalDbId, { provider, terminalId, name, isActive });
      return terminalDbId;
    }
    return ctx.db.insert("posTerminals", {
      clubId, provider, terminalId, name, isActive,
      createdAt: new Date().toISOString(),
    });
  },
});

export const remove = mutation({
  args: { terminalDbId: v.id("posTerminals") },
  handler: async (ctx, { terminalDbId }) => {
    const t = await ctx.db.get(terminalDbId);
    if (!t) throw new Error("Not found");
    await assertAdmin(ctx, t.clubId);
    await ctx.db.delete(terminalDbId);
  },
});
