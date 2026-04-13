import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function assertAdmin(ctx: MutationCtx, clubId: Id<"clubs">) {
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

async function assertMember(ctx: MutationCtx | QueryCtx, clubId: Id<"clubs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return identity.subject;
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", identity.subject))
    .unique();
  if (!member || member.status !== "active") throw new Error("Not a member");
  return identity.subject;
}

// ── Categories ────────────────────────────────────────────────────────────────

export const listCategories = query({
  args: {
    clubId:     v.id("clubs"),
    locationId: v.optional(v.id("posLocations")),
  },
  handler: async (ctx, { clubId, locationId }) => {
    const all = await ctx.db
      .query("posCategories")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .collect();
    // When filtering by location: include categories for that location + global categories
    if (locationId) {
      return all.filter(c => !c.locationId || c.locationId === locationId);
    }
    return all;
  },
});

export const saveCategory = mutation({
  args: {
    clubId:     v.id("clubs"),
    categoryId: v.optional(v.id("posCategories")),
    locationId: v.optional(v.id("posLocations")),
    name:       v.string(),
    icon:       v.optional(v.string()),
    sortOrder:  v.optional(v.number()),
  },
  handler: async (ctx, { clubId, categoryId, name, icon, sortOrder, locationId }) => {
    await assertAdmin(ctx, clubId);
    if (categoryId) {
      await ctx.db.patch(categoryId, { name, icon: icon ?? undefined, locationId: locationId ?? undefined });
      return categoryId;
    }
    const existing = await ctx.db.query("posCategories").withIndex("by_club", q => q.eq("clubId", clubId)).collect();
    return ctx.db.insert("posCategories", {
      clubId, name, icon: icon ?? undefined,
      locationId: locationId ?? undefined,
      sortOrder: sortOrder ?? existing.length,
      createdAt: new Date().toISOString(),
    });
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("posCategories") },
  handler: async (ctx, { categoryId }) => {
    const cat = await ctx.db.get(categoryId);
    if (!cat) throw new Error("Not found");
    await assertAdmin(ctx, cat.clubId);
    await ctx.db.delete(categoryId);
  },
});

// ── Products ──────────────────────────────────────────────────────────────────

export const listProducts = query({
  args: {
    clubId:          v.id("clubs"),
    includeInactive: v.optional(v.boolean()),
    locationId:      v.optional(v.id("posLocations")),
  },
  handler: async (ctx, { clubId, includeInactive, locationId }) => {
    const all = await ctx.db
      .query("posProducts")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .collect();
    let results = includeInactive ? all : all.filter(p => p.isActive);
    // When a locationId filter is supplied, include products that either
    // belong to that location OR have no location set (global/all-locations products).
    if (locationId) {
      results = results.filter(
        p => !p.locationId || p.locationId === locationId
      );
    }
    return results;
  },
});

export const saveProduct = mutation({
  args: {
    clubId:     v.id("clubs"),
    productId:  v.optional(v.id("posProducts")),
    categoryId: v.optional(v.id("posCategories")),
    locationId: v.optional(v.id("posLocations")),
    name:        v.string(),
    sku:         v.optional(v.string()),
    description: v.optional(v.string()),
    pricePence:  v.number(),
    currency:    v.string(),
    trackStock:  v.optional(v.boolean()),
    stockCount:  v.optional(v.number()),
    isActive:    v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { clubId, productId, ...fields } = args;
    await assertAdmin(ctx, clubId);
    const now = new Date().toISOString();
    if (productId) {
      await ctx.db.patch(productId, { ...fields, updatedAt: now });
      return productId;
    }
    return ctx.db.insert("posProducts", {
      clubId,
      ...fields,
      isActive: fields.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const adjustStock = mutation({
  args: { productId: v.id("posProducts"), delta: v.number() },
  handler: async (ctx, { productId, delta }) => {
    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Not found");
    await assertAdmin(ctx, product.clubId);
    const current = product.stockCount ?? 0;
    await ctx.db.patch(productId, { stockCount: current + delta, updatedAt: new Date().toISOString() });
  },
});

export const deleteProduct = mutation({
  args: { productId: v.id("posProducts") },
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Not found");
    await assertAdmin(ctx, product.clubId);
    // Soft-delete by deactivating so sales history is intact
    await ctx.db.patch(productId, { isActive: false, updatedAt: new Date().toISOString() });
  },
});

// ── Sales ─────────────────────────────────────────────────────────────────────

export const recordSale = mutation({
  args: {
    clubId: v.id("clubs"),
    memberId: v.optional(v.string()),
    memberName: v.optional(v.string()),
    // If paymentMethod === "account", chargeAccountMemberId must be supplied
    chargeAccountMemberId: v.optional(v.id("clubMembers")),
    items: v.array(v.object({
      productId: v.optional(v.id("posProducts")),
      productName: v.string(),
      quantity: v.number(),
      unitPricePence: v.number(),
      subtotalPence: v.number(),
    })),
    currency: v.string(),
    paymentMethod: v.string(),
    notes: v.optional(v.string()),
    // Shift & location context
    shiftId:    v.optional(v.id("posShifts")),
    locationId: v.optional(v.id("posLocations")),
    isGuest:    v.optional(v.boolean()),
    // Kiosk identity — when present, authenticates the sale as a kiosk
    // device rather than a logged-in user (no Clerk session required)
    kioskId:    v.optional(v.id("posKiosks")),
  },
  handler: async (ctx, args) => {
    // Auth: kiosk sales are authenticated by device identity (kioskId);
    // admin-panel sales require a logged-in club member.
    let userId: string;
    if (args.kioskId) {
      const kiosk = await ctx.db.get(args.kioskId);
      if (!kiosk || kiosk.clubId !== args.clubId) throw new Error("Invalid kiosk");
      userId = `kiosk:${args.kioskId}`;
    } else {
      userId = await assertMember(ctx, args.clubId);
    }
    const subtotalPence = args.items.reduce((s, i) => s + i.subtotalPence, 0);

    // Account charge — check and deduct atomically before writing the sale
    if (args.paymentMethod === "account") {
      if (!args.chargeAccountMemberId) throw new Error("Member account not specified");
      const member = await ctx.db.get(args.chargeAccountMemberId);
      if (!member) throw new Error("Member not found");
      const balance = member.accountBalance ?? 0;
      if (balance < subtotalPence) {
        throw new Error(`Insufficient balance (${(balance / 100).toFixed(2)} available, ${(subtotalPence / 100).toFixed(2)} needed)`);
      }
      const newBalance = balance - subtotalPence;
      await ctx.db.patch(args.chargeAccountMemberId, { accountBalance: newBalance });

      const saleId = await ctx.db.insert("posSales", {
        clubId: args.clubId,
        memberId: member.userId,
        clubMemberId: args.chargeAccountMemberId,
        memberName: member.displayName,
        items: args.items,
        subtotalPence,
        totalPence: subtotalPence,
        currency: args.currency,
        paymentMethod: "account",
        notes: args.notes,
        servedBy: userId,
        shiftId:    args.shiftId,
        locationId: args.locationId,
        isGuest:    args.isGuest,
        createdAt: new Date().toISOString(),
      });

      await ctx.db.insert("memberAccountTransactions", {
        clubId: args.clubId,
        memberId: args.chargeAccountMemberId,
        userId: member.userId,
        type: "charge",
        amount: -subtotalPence,
        balanceAfter: newBalance,
        description: args.items.map(i => `${i.quantity}× ${i.productName}`).join(", "),
        saleId,
        processedBy: userId,
        createdAt: new Date().toISOString(),
      });

      // Decrement stock
      for (const item of args.items) {
        if (item.productId) {
          const product = await ctx.db.get(item.productId);
          if (product?.trackStock && product.stockCount != null) {
            await ctx.db.patch(item.productId, { stockCount: Math.max(0, product.stockCount - item.quantity), updatedAt: new Date().toISOString() });
          }
        }
      }
      return saleId;
    }

    const saleId = await ctx.db.insert("posSales", {
      clubId: args.clubId,
      memberId: args.memberId,
      memberName: args.memberName,
      items: args.items,
      subtotalPence,
      totalPence: subtotalPence,
      currency: args.currency,
      paymentMethod: args.paymentMethod,
      notes: args.notes,
      servedBy: userId,
      shiftId:    args.shiftId,
      locationId: args.locationId,
      isGuest:    args.isGuest,
      createdAt: new Date().toISOString(),
    });
    // Decrement tracked stock
    for (const item of args.items) {
      if (item.productId) {
        const product = await ctx.db.get(item.productId);
        if (product?.trackStock && product.stockCount != null) {
          await ctx.db.patch(item.productId, {
            stockCount: Math.max(0, product.stockCount - item.quantity),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
    return saleId;
  },
});

export const voidSale = mutation({
  args: { saleId: v.id("posSales") },
  handler: async (ctx, { saleId }) => {
    const sale = await ctx.db.get(saleId);
    if (!sale) throw new Error("Not found");
    await assertAdmin(ctx, sale.clubId);
    await ctx.db.patch(saleId, { voidedAt: new Date().toISOString() });
  },
});

export const listSales = query({
  args: {
    clubId: v.id("clubs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { clubId, limit }) => {
    return ctx.db
      .query("posSales")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .order("desc")
      .take(limit ?? 200);
  },
});

export const salesSummary = query({
  args: { clubId: v.id("clubs"), date: v.optional(v.string()) },
  handler: async (ctx, { clubId, date }) => {
    const all = await ctx.db
      .query("posSales")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .collect();
    const sales = all.filter(s => !s.voidedAt && (!date || s.createdAt.startsWith(date)));
    const totalRevenue = sales.reduce((s, sale) => s + sale.totalPence, 0);
    const cashRevenue = sales.filter(s => s.paymentMethod === "cash").reduce((s, sale) => s + sale.totalPence, 0);
    const cardRevenue = sales.filter(s => s.paymentMethod === "card" || s.paymentMethod === "terminal").reduce((s, sale) => s + sale.totalPence, 0);
    return { count: sales.length, totalRevenue, cashRevenue, cardRevenue };
  },
});
