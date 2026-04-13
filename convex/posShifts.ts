import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Auth ──────────────────────────────────────────────────────────────────────

async function assertAdmin(ctx: MutationCtx, clubId: Id<"clubs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",").map((e) => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return identity.subject;
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", (q) =>
      q.eq("clubId", clubId).eq("userId", identity.subject)
    )
    .unique();
  if (!member || member.role !== "admin") throw new Error("Not authorised");
  return identity.subject;
}

/**
 * Authenticate either as a logged-in admin OR as a kiosk device.
 * Kiosk mutations pass kioskId instead of a Clerk session — we verify
 * the kiosk belongs to the correct club and return a synthetic actor ID.
 */
async function assertAdminOrKiosk(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  kioskId?: Id<"posKiosks">,
): Promise<string> {
  if (kioskId) {
    const kiosk = await ctx.db.get(kioskId);
    if (!kiosk || kiosk.clubId !== clubId) throw new Error("Invalid kiosk");
    return `kiosk:${kioskId}`;
  }
  return assertAdmin(ctx, clubId);
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** All shifts for a club, most recent first */
export const listShifts = query({
  args: {
    clubId:     v.id("clubs"),
    locationId: v.optional(v.id("posLocations")),
    limit:      v.optional(v.number()),
  },
  handler: async (ctx, { clubId, locationId, limit }) => {
    let rows = await ctx.db
      .query("posShifts")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .order("desc")
      .take(limit ?? 50);

    if (locationId) {
      rows = rows.filter((r) => r.locationId === locationId);
    }

    // Join location names
    const locIds = [...new Set(rows.map((r) => r.locationId))];
    const locs = await Promise.all(locIds.map((id) => ctx.db.get(id)));
    const locMap = new Map(locs.filter(Boolean).map((l) => [l!._id, l!.name]));

    return rows.map((r) => ({
      ...r,
      locationName: locMap.get(r.locationId) ?? "Unknown",
    }));
  },
});

/** The currently open shift for a given location (if any) */
export const getOpenShift = query({
  args: {
    clubId:     v.id("clubs"),
    locationId: v.id("posLocations"),
  },
  handler: async (ctx, { clubId, locationId }) => {
    const open = await ctx.db
      .query("posShifts")
      .withIndex("by_club_and_status", (q) =>
        q.eq("clubId", clubId).eq("status", "open")
      )
      .filter((q) => q.eq(q.field("locationId"), locationId))
      .first();
    return open ?? null;
  },
});

/** Stock takes for a given shift */
export const getStockTakes = query({
  args: { shiftId: v.id("posShifts") },
  handler: async (ctx, { shiftId }) => {
    return ctx.db
      .query("posStockTakes")
      .withIndex("by_shift", (q) => q.eq("shiftId", shiftId))
      .collect();
  },
});

/** All sales that belong to a shift (non-voided) */
export const getShiftSales = query({
  args: { shiftId: v.id("posShifts") },
  handler: async (ctx, { shiftId }) => {
    const all = await ctx.db
      .query("posSales")
      .withIndex("by_shift", (q) => q.eq("shiftId", shiftId))
      .collect();
    return all.filter((s) => !s.voidedAt);
  },
});

/** Full shift report — sales summary + stock variance */
export const getShiftReport = query({
  args: { shiftId: v.id("posShifts") },
  handler: async (ctx, { shiftId }) => {
    const shift = await ctx.db.get(shiftId);
    if (!shift) return null;

    const location = await ctx.db.get(shift.locationId);

    // Sales
    const allSales = await ctx.db
      .query("posSales")
      .withIndex("by_shift", (q) => q.eq("shiftId", shiftId))
      .collect();
    const sales = allSales.filter((s) => !s.voidedAt);

    const totalPence    = sales.reduce((s, x) => s + x.totalPence, 0);
    const cashPence     = sales.filter((s) => s.paymentMethod === "cash").reduce((s, x) => s + x.totalPence, 0);
    const cardPence     = sales.filter((s) => s.paymentMethod === "card" || s.paymentMethod === "terminal").reduce((s, x) => s + x.totalPence, 0);
    const accountPence  = sales.filter((s) => s.paymentMethod === "account").reduce((s, x) => s + x.totalPence, 0);
    const compPence     = sales.filter((s) => s.paymentMethod === "complimentary").reduce((s, x) => s + x.totalPence, 0);
    const guestPence    = sales.filter((s) => s.isGuest).reduce((s, x) => s + x.totalPence, 0);
    const memberPence   = sales.filter((s) => !s.isGuest && s.paymentMethod !== "complimentary").reduce((s, x) => s + x.totalPence, 0);

    // Units sold per product
    const unitsSold = new Map<string, number>();
    for (const sale of sales) {
      for (const item of sale.items) {
        if (item.productId) {
          unitsSold.set(item.productId, (unitsSold.get(item.productId) ?? 0) + item.quantity);
        }
      }
    }

    // Stock takes
    const stockTakes = await ctx.db
      .query("posStockTakes")
      .withIndex("by_shift", (q) => q.eq("shiftId", shiftId))
      .collect();

    const opening   = stockTakes.find((t) => t.type === "opening");
    const closing   = stockTakes.find((t) => t.type === "closing");
    const spotTakes = stockTakes
      .filter((t) => t.type === "spot")
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
      .map((t) => ({
        _id:         t._id,
        takenAt:     t.takenAt,
        takenByName: t.takenByName,
        notes:       t.notes,
        counts:      t.counts,
      }));

    // Build variance table (only products present in at least one stock take)
    const productIds = new Set([
      ...(opening?.counts.map((c) => c.productId) ?? []),
      ...(closing?.counts.map((c) => c.productId) ?? []),
    ]);

    const stockVariance = [...productIds].map((productId) => {
      const openCount  = opening?.counts.find((c) => c.productId === productId)?.countedUnits ?? null;
      const closeCount = closing?.counts.find((c) => c.productId === productId)?.countedUnits ?? null;
      const productName = opening?.counts.find((c) => c.productId === productId)?.productName
        ?? closing?.counts.find((c) => c.productId === productId)?.productName
        ?? "Unknown";
      const sold         = unitsSold.get(productId) ?? 0;
      const expected     = openCount !== null && closeCount !== null ? openCount - closeCount : null;
      const variance     = expected !== null ? sold - expected : null; // +ve = sold more than counted, -ve = shrinkage

      return { productId, productName, openCount, closeCount, sold, expected, variance };
    }).sort((a, b) => a.productName.localeCompare(b.productName));

    return {
      shift,
      locationName: location?.name ?? "Unknown",
      summary: {
        totalPence,
        cashPence,
        cardPence,
        accountPence,
        compPence,
        guestPence,
        memberPence,
        saleCount: sales.length,
      },
      hasOpeningStockTake:  !!opening,
      hasClosingStockTake:  !!closing,
      openingTakenByName:   opening?.takenByName,
      openingTakenAt:       opening?.takenAt,
      closingTakenByName:   closing?.takenByName,
      closingTakenAt:       closing?.takenAt,
      spotTakes,
      stockVariance,
    };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Open a new shift for a location. Fails if one is already open. */
export const openShift = mutation({
  args: {
    clubId:     v.id("clubs"),
    locationId: v.id("posLocations"),
    kioskId:    v.optional(v.id("posKiosks")),
    notes:      v.optional(v.string()),
  },
  handler: async (ctx, { clubId, locationId, kioskId, notes }) => {
    const userId = await assertAdminOrKiosk(ctx, clubId, kioskId);

    // Guard: only one open shift per location
    const existing = await ctx.db
      .query("posShifts")
      .withIndex("by_club_and_status", (q) =>
        q.eq("clubId", clubId).eq("status", "open")
      )
      .filter((q) => q.eq(q.field("locationId"), locationId))
      .first();

    if (existing) {
      throw new Error("A shift is already open for this location. Close it before opening a new one.");
    }

    const now = new Date().toISOString();
    return ctx.db.insert("posShifts", {
      clubId,
      locationId,
      kioskId,
      openedBy: userId,
      status: "open",
      openedAt: now,
      notes,
      createdAt: now,
    });
  },
});

/** Close an open shift. */
export const closeShift = mutation({
  args: {
    shiftId: v.id("posShifts"),
    notes:   v.optional(v.string()),
    kioskId: v.optional(v.id("posKiosks")),
  },
  handler: async (ctx, { shiftId, notes, kioskId }) => {
    const shift = await ctx.db.get(shiftId);
    if (!shift) throw new Error("Shift not found");
    if (shift.status === "closed") throw new Error("Shift is already closed");

    const userId = await assertAdminOrKiosk(ctx, shift.clubId, kioskId);
    const now = new Date().toISOString();

    await ctx.db.patch(shiftId, {
      status:   "closed",
      closedBy: userId,
      closedAt: now,
      ...(notes ? { notes } : {}),
    });
  },
});

/** Record a stock take (opening, closing, or mid-shift spot) for a shift. */
export const recordStockTake = mutation({
  args: {
    clubId:      v.id("clubs"),
    shiftId:     v.id("posShifts"),
    locationId:  v.id("posLocations"),
    type:        v.string(), // "opening" | "closing" | "spot"
    takenByName: v.string(), // human-entered staff name
    counts: v.array(v.object({
      productId:    v.id("posProducts"),
      productName:  v.string(),
      countedUnits: v.number(),
    })),
    notes:   v.optional(v.string()),
    kioskId: v.optional(v.id("posKiosks")),
  },
  handler: async (ctx, { clubId, shiftId, locationId, type, takenByName, counts, notes, kioskId }) => {
    const userId = await assertAdminOrKiosk(ctx, clubId, kioskId);

    const shift = await ctx.db.get(shiftId);
    if (!shift) throw new Error("Shift not found");
    if (shift.clubId !== clubId) throw new Error("Shift does not belong to this club");

    const now = new Date().toISOString();

    // Spot takes are always inserted (multiple allowed per shift).
    // Opening and closing takes allow overwrite — only one of each per shift.
    if (type !== "spot") {
      const existing = await ctx.db
        .query("posStockTakes")
        .withIndex("by_shift", (q) => q.eq("shiftId", shiftId))
        .filter((q) => q.eq(q.field("type"), type))
        .first();

      if (existing) {
        throw new Error(`A ${type} stock take has already been recorded for this shift and cannot be overwritten`);
      }
    }

    return ctx.db.insert("posStockTakes", {
      clubId,
      locationId,
      shiftId,
      type,
      takenBy:     userId,
      takenByName,
      takenAt:     now,
      counts,
      notes,
      createdAt:   now,
    });
  },
});
