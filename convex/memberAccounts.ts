import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function assertStaff(ctx: MutationCtx, clubId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return identity.subject;
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", q => q.eq("clubId", clubId as any).eq("userId", identity.subject))
    .unique();
  if (!member || member.status !== "active") throw new Error("Not a member");
  if (member.role !== "admin" && member.role !== "staff") throw new Error("Not authorised");
  return identity.subject;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const getBalance = query({
  args: { memberId: v.id("clubMembers") },
  handler: async (ctx, { memberId }) => {
    const member = await ctx.db.get(memberId);
    return member?.accountBalance ?? 0;
  },
});

export const listTransactions = query({
  args: { memberId: v.id("clubMembers"), limit: v.optional(v.number()) },
  handler: async (ctx, { memberId, limit }) => {
    const txs = await ctx.db
      .query("memberAccountTransactions")
      .withIndex("by_member", q => q.eq("memberId", memberId))
      .order("desc")
      .collect();
    return limit ? txs.slice(0, limit) : txs;
  },
});

// Search active members by name or membership number — used by the kiosk
export const searchMembers = query({
  args: { clubId: v.id("clubs"), search: v.string() },
  handler: async (ctx, { clubId, search }) => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    const members = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_status", q2 => q2.eq("clubId", clubId).eq("status", "active"))
      .collect();
    return members
      .filter(m =>
        m.displayName.toLowerCase().includes(q) ||
        m.fgcMemberId?.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map(m => ({
        _id: m._id,
        displayName: m.displayName,
        fgcMemberId: m.fgcMemberId,
        accountBalance: m.accountBalance ?? 0,
        avatarUrl: m.avatarUrl,
        handicap: m.handicap,
      }));
  },
});

// All members with their balances — for the admin top-up view
export const listBalances = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const members = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_status", q => q.eq("clubId", clubId).eq("status", "active"))
      .collect();
    return members
      .map(m => ({
        _id: m._id,
        displayName: m.displayName,
        fgcMemberId: m.fgcMemberId,
        accountBalance: m.accountBalance ?? 0,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const topUp = mutation({
  args: {
    memberId: v.id("clubMembers"),
    amount: v.number(),                          // pence
    description: v.optional(v.string()),
  },
  handler: async (ctx, { memberId, amount, description }) => {
    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");
    await assertStaff(ctx, member.clubId);
    const newBalance = (member.accountBalance ?? 0) + amount;
    await ctx.db.patch(memberId, { accountBalance: newBalance });
    const identity = await ctx.auth.getUserIdentity();
    await ctx.db.insert("memberAccountTransactions", {
      clubId: member.clubId,
      memberId,
      userId: member.userId,
      type: "topup",
      amount,
      balanceAfter: newBalance,
      description: description ?? "Account top-up",
      processedBy: identity!.subject,
      createdAt: new Date().toISOString(),
    });
    return newBalance;
  },
});

export const adjust = mutation({
  args: {
    memberId: v.id("clubMembers"),
    amount: v.number(),       // pence — positive or negative
    description: v.string(),
  },
  handler: async (ctx, { memberId, amount, description }) => {
    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");
    await assertStaff(ctx, member.clubId);
    const newBalance = (member.accountBalance ?? 0) + amount;
    await ctx.db.patch(memberId, { accountBalance: newBalance });
    const identity = await ctx.auth.getUserIdentity();
    await ctx.db.insert("memberAccountTransactions", {
      clubId: member.clubId,
      memberId,
      userId: member.userId,
      type: "adjustment",
      amount,
      balanceAfter: newBalance,
      description,
      processedBy: identity!.subject,
      createdAt: new Date().toISOString(),
    });
    return newBalance;
  },
});
