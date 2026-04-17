import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { recordSaleInternal } from "./_internal/posHelpers";

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Authenticate as a logged-in club member (any role) OR as a kiosk device.
 * Tabs can be opened/modified by any staff member, not just admins.
 */
async function assertMemberOrKiosk(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  kioskId?: Id<"posKiosks">,
): Promise<string> {
  if (kioskId) {
    const kiosk = await ctx.db.get(kioskId);
    if (!kiosk || kiosk.clubId !== clubId) throw new Error("Invalid kiosk");
    return `kiosk:${kioskId}`;
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  // Super admins always allowed
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",").map((e) => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email))
    return identity.subject;
  // Any active club member can operate the till
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", (q) =>
      q.eq("clubId", clubId).eq("userId", identity.subject)
    )
    .unique();
  if (!member || member.status !== "active") throw new Error("Not a club member");
  return identity.subject;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Open a new tab, optionally with a name ("Table 4", "Jamie"), location, and shift. */
export const openTab = mutation({
  args: {
    clubId:     v.id("clubs"),
    locationId: v.optional(v.id("posLocations")),
    shiftId:    v.optional(v.id("posShifts")),
    name:       v.optional(v.string()),
    kioskId:    v.optional(v.id("posKiosks")),
  },
  handler: async (ctx, args) => {
    const openedBy = await assertMemberOrKiosk(ctx, args.clubId, args.kioskId);
    const now = new Date().toISOString();
    return ctx.db.insert("posTabs", {
      clubId:     args.clubId,
      locationId: args.locationId,
      shiftId:    args.shiftId,
      name:       args.name,
      status:     "open",
      items:      [],
      openedBy,
      createdAt:  now,
      updatedAt:  now,
    });
  },
});

/**
 * Add an item to a tab. For regular products, increments quantity if the
 * same productId is already on the tab. Custom items always add a new row.
 */
export const addItem = mutation({
  args: {
    tabId:          v.id("posTabs"),
    productId:      v.optional(v.id("posProducts")),
    productName:    v.string(),
    unitPricePence: v.number(),
    quantity:       v.optional(v.number()), // defaults to 1
  },
  handler: async (ctx, args) => {
    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.status !== "open") throw new Error("Tab not found or not open");

    const qty = args.quantity ?? 1;
    const items = [...tab.items];

    if (args.productId) {
      // Merge with existing line for the same product
      const idx = items.findIndex(
        (i) => i.productId !== undefined && i.productId === args.productId,
      );
      if (idx >= 0) {
        const newQty = items[idx].quantity + qty;
        items[idx] = {
          ...items[idx],
          quantity: newQty,
          subtotalPence: newQty * items[idx].unitPricePence,
        };
      } else {
        items.push({
          productId:      args.productId,
          productName:    args.productName,
          quantity:       qty,
          unitPricePence: args.unitPricePence,
          subtotalPence:  qty * args.unitPricePence,
        });
      }
    } else {
      // Custom item — always a new row
      items.push({
        productName:    args.productName,
        quantity:       qty,
        unitPricePence: args.unitPricePence,
        subtotalPence:  qty * args.unitPricePence,
      });
    }

    await ctx.db.patch(args.tabId, { items, updatedAt: new Date().toISOString() });
  },
});

/** Update the quantity of a line item by index. Set quantity to 0 to remove it. */
export const updateItem = mutation({
  args: {
    tabId:     v.id("posTabs"),
    itemIndex: v.number(),
    quantity:  v.number(),
  },
  handler: async (ctx, args) => {
    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.status !== "open") throw new Error("Tab not found or not open");
    if (args.itemIndex < 0 || args.itemIndex >= tab.items.length)
      throw new Error("Item index out of range");

    let items = [...tab.items];
    if (args.quantity <= 0) {
      items = items.filter((_, i) => i !== args.itemIndex);
    } else {
      items[args.itemIndex] = {
        ...items[args.itemIndex],
        quantity: args.quantity,
        subtotalPence: args.quantity * items[args.itemIndex].unitPricePence,
      };
    }

    await ctx.db.patch(args.tabId, { items, updatedAt: new Date().toISOString() });
  },
});

/** Remove a line item by index. */
export const removeItem = mutation({
  args: {
    tabId:     v.id("posTabs"),
    itemIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.status !== "open") throw new Error("Tab not found or not open");
    const items = tab.items.filter((_, i) => i !== args.itemIndex);
    await ctx.db.patch(args.tabId, { items, updatedAt: new Date().toISOString() });
  },
});

/** Rename a tab. */
export const renameTab = mutation({
  args: {
    tabId: v.id("posTabs"),
    name:  v.string(),
  },
  handler: async (ctx, args) => {
    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.status !== "open") throw new Error("Tab not found or not open");
    await ctx.db.patch(args.tabId, {
      name: args.name.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Close a tab — record the sale and mark the tab closed.
 * Uses the shared recordSaleInternal helper so account-charge and
 * stock-decrement logic stays consistent with quick-sale mode.
 */
export const closeTab = mutation({
  args: {
    tabId:                 v.id("posTabs"),
    paymentMethod:         v.string(),
    currency:              v.string(),
    chargeAccountMemberId: v.optional(v.id("clubMembers")),
    memberId:              v.optional(v.string()),
    memberName:            v.optional(v.string()),
    notes:                 v.optional(v.string()),
    isGuest:               v.optional(v.boolean()),
    kioskId:               v.optional(v.id("posKiosks")),
    splits: v.optional(v.array(v.object({
      method:      v.string(),
      amountPence: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.status !== "open") throw new Error("Tab is not open");
    if (tab.items.length === 0) throw new Error("Cannot close an empty tab");

    const servedBy = await assertMemberOrKiosk(ctx, tab.clubId, args.kioskId);
    const now = new Date().toISOString();

    const saleId = await recordSaleInternal(ctx, {
      clubId:                tab.clubId,
      memberId:              args.memberId,
      memberName:            args.memberName,
      chargeAccountMemberId: args.chargeAccountMemberId,
      items:                 tab.items,
      currency:              args.currency,
      paymentMethod:         args.paymentMethod,
      splits:                args.splits,
      notes:                 args.notes,
      shiftId:               tab.shiftId,
      locationId:            tab.locationId,
      isGuest:               args.isGuest,
      servedBy,
    });

    await ctx.db.patch(args.tabId, {
      status:   "closed",
      closedAt: now,
      closedBy: servedBy,
      saleId,
      updatedAt: now,
    });

    return saleId;
  },
});

/** Void a tab — discard all items without recording a sale. */
export const voidTab = mutation({
  args: {
    tabId:   v.id("posTabs"),
    kioskId: v.optional(v.id("posKiosks")),
  },
  handler: async (ctx, args) => {
    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.status !== "open") throw new Error("Tab is not open");
    const closedBy = await assertMemberOrKiosk(ctx, tab.clubId, args.kioskId);
    const now = new Date().toISOString();
    await ctx.db.patch(args.tabId, {
      status:   "voided",
      closedAt: now,
      closedBy,
      updatedAt: now,
    });
  },
});

// ── Queries ───────────────────────────────────────────────────────────────────

/** List all open tabs for a club, optionally filtered to a specific location. */
export const listOpenTabs = query({
  args: {
    clubId:     v.id("clubs"),
    locationId: v.optional(v.id("posLocations")),
  },
  handler: async (ctx, { clubId, locationId }) => {
    const tabs = await ctx.db
      .query("posTabs")
      .withIndex("by_club_and_status", (q) =>
        q.eq("clubId", clubId).eq("status", "open")
      )
      .collect();
    if (locationId) {
      return tabs.filter((t) => !t.locationId || t.locationId === locationId);
    }
    return tabs;
  },
});

/** Get a single tab by ID. */
export const getTab = query({
  args: { tabId: v.id("posTabs") },
  handler: async (ctx, { tabId }) => {
    return ctx.db.get(tabId);
  },
});
