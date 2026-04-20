import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function assertAdminOrSelf(
  ctx: MutationCtx | QueryCtx,
  memberId: Id<"clubMembers">
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return identity.subject;

  const member = await ctx.db.get(memberId);
  if (!member) throw new Error("Member not found");

  // The member themselves
  if (member.userId === identity.subject) return identity.subject;

  // Club admin
  const caller = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", (q) =>
      q.eq("clubId", member.clubId).eq("userId", identity.subject)
    )
    .unique();
  if (caller?.role === "admin") return identity.subject;

  throw new Error("Not authorised");
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
  args: {
    memberId: v.id("clubMembers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { memberId, limit }) => {
    const txs = await ctx.db
      .query("memberAccountTransactions")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .order("desc")
      .take(limit ?? 50);
    return txs;
  },
});

// ── Mutations (internal — called by webhook handler + POS) ────────────────────

export const creditWallet = mutation({
  args: {
    clubId: v.id("clubs"),
    memberId: v.id("clubMembers"),
    amount: v.number(),           // pence, must be positive
    description: v.string(),
    processedBy: v.string(),      // userId of whoever triggered this (or "webhook")
    paymentIntentId: v.optional(v.id("paymentIntents")),
  },
  handler: async (ctx, { clubId, memberId, amount, description, processedBy, paymentIntentId }) => {
    if (amount <= 0) throw new Error("Credit amount must be positive");

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");

    const currentBalance = member.accountBalance ?? 0;
    const balanceAfter = currentBalance + amount;

    await ctx.db.patch(memberId, { accountBalance: balanceAfter });

    return ctx.db.insert("memberAccountTransactions", {
      clubId,
      memberId,
      userId: member.userId,
      type: "topup",
      amount,
      balanceAfter,
      description,
      saleId: undefined,
      processedBy,
      createdAt: new Date().toISOString(),
    });
  },
});

export const debitWallet = mutation({
  args: {
    clubId: v.id("clubs"),
    memberId: v.id("clubMembers"),
    amount: v.number(),           // pence, must be positive — will be stored as negative
    type: v.string(),             // 'charge' | 'green_fee' | 'competition' | 'tee_time'
    description: v.string(),
    processedBy: v.string(),
    saleId: v.optional(v.id("posSales")),
  },
  handler: async (ctx, { clubId, memberId, amount, type, description, processedBy, saleId }) => {
    if (amount <= 0) throw new Error("Debit amount must be positive");

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");

    const currentBalance = member.accountBalance ?? 0;
    if (currentBalance < amount) throw new Error("Insufficient balance");

    const balanceAfter = currentBalance - amount;
    await ctx.db.patch(memberId, { accountBalance: balanceAfter });

    return ctx.db.insert("memberAccountTransactions", {
      clubId,
      memberId,
      userId: member.userId,
      type,
      amount: -amount,
      balanceAfter,
      description,
      saleId,
      processedBy,
      createdAt: new Date().toISOString(),
    });
  },
});

export const refundToWallet = mutation({
  args: {
    transactionId: v.id("memberAccountTransactions"),
    processedBy: v.string(),
  },
  handler: async (ctx, { transactionId, processedBy }) => {
    const tx = await ctx.db.get(transactionId);
    if (!tx) throw new Error("Transaction not found");
    if (tx.amount >= 0) throw new Error("Can only refund a debit");

    const refundAmount = Math.abs(tx.amount);
    const member = await ctx.db.get(tx.memberId);
    if (!member) throw new Error("Member not found");

    const balanceAfter = (member.accountBalance ?? 0) + refundAmount;
    await ctx.db.patch(tx.memberId, { accountBalance: balanceAfter });

    return ctx.db.insert("memberAccountTransactions", {
      clubId: tx.clubId,
      memberId: tx.memberId,
      userId: tx.userId,
      type: "refund",
      amount: refundAmount,
      balanceAfter,
      description: `Refund: ${tx.description}`,
      saleId: undefined,
      processedBy,
      createdAt: new Date().toISOString(),
    });
  },
});

// Get a single payment intent by ID — used by POS to poll terminal status
export const getPaymentIntent = query({
  args: { intentId: v.id("paymentIntents") },
  handler: async (ctx, { intentId }) => {
    return ctx.db.get(intentId);
  },
});

// Cancel a pending payment intent (called by POS when user hits cancel)
export const cancelPaymentIntent = mutation({
  args: { intentId: v.id("paymentIntents") },
  handler: async (ctx, { intentId }) => {
    const intent = await ctx.db.get(intentId);
    if (!intent) throw new Error("Intent not found");
    if (intent.status !== "pending") return; // already resolved
    await ctx.db.patch(intentId, {
      status: "cancelled",
      completedAt: new Date().toISOString(),
    });
  },
});

// Called by webhook handler after Dojo/Square confirms capture
export const resolvePaymentIntent = mutation({
  args: {
    provider: v.string(),
    providerIntentId: v.string(),
    status: v.string(),           // 'captured' | 'failed' | 'refunded'
  },
  handler: async (ctx, { provider, providerIntentId, status }) => {
    const intent = await ctx.db
      .query("paymentIntents")
      .withIndex("by_provider_intent", (q) =>
        q.eq("provider", provider).eq("providerIntentId", providerIntentId)
      )
      .unique();

    if (!intent) throw new Error("Payment intent not found");
    if (intent.status !== "pending") return intent; // already resolved — idempotent

    await ctx.db.patch(intent._id, {
      status,
      completedAt: new Date().toISOString(),
    });

    // Auto-credit wallet for top-ups
    if (status === "captured" && intent.purpose === "topup" && intent.clubMemberId) {
      const member = await ctx.db.get(intent.clubMemberId);
      if (member) {
        const currentBalance = member.accountBalance ?? 0;
        const balanceAfter = currentBalance + intent.amount;
        await ctx.db.patch(intent.clubMemberId, { accountBalance: balanceAfter });
        await ctx.db.insert("memberAccountTransactions", {
          clubId: intent.clubId,
          memberId: intent.clubMemberId,
          userId: member.userId,
          type: "topup",
          amount: intent.amount,
          balanceAfter,
          description: `Online top-up via ${intent.provider}`,
          saleId: undefined,
          processedBy: "webhook",
          createdAt: new Date().toISOString(),
        });
      }
    }

    return ctx.db.get(intent._id);
  },
});

// Create a pending payment intent record (called before hitting payment provider)
export const createPaymentIntent = mutation({
  args: {
    clubId: v.id("clubs"),
    clubMemberId: v.optional(v.id("clubMembers")),
    provider: v.string(),
    providerIntentId: v.string(),
    amount: v.number(),
    currency: v.string(),
    purpose: v.string(),
    terminalId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("paymentIntents", {
      ...args,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  },
});

// Link a sale to a payment intent after the sale is recorded
export const linkSaleToIntent = mutation({
  args: {
    intentId: v.id("paymentIntents"),
    saleId: v.id("posSales"),
  },
  handler: async (ctx, { intentId, saleId }) => {
    await ctx.db.patch(intentId, { saleId });
  },
});

// Manual top-up / adjustment by admin (cash top-up at reception, etc.)
export const adminTopUp = mutation({
  args: {
    clubId: v.id("clubs"),
    memberId: v.id("clubMembers"),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, { clubId, memberId, amount, description }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await assertAdminOrSelf(ctx, memberId);

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");

    const currentBalance = member.accountBalance ?? 0;
    const balanceAfter = currentBalance + amount;

    await ctx.db.patch(memberId, { accountBalance: balanceAfter });

    return ctx.db.insert("memberAccountTransactions", {
      clubId,
      memberId,
      userId: member.userId,
      type: amount > 0 ? "topup" : "adjustment",
      amount,
      balanceAfter,
      description,
      saleId: undefined,
      processedBy: identity.subject,
      createdAt: new Date().toISOString(),
    });
  },
});
