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

// ============================================================================
// Locations
// ============================================================================

export const listLocations = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("posLocations")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect()
      .then((rows) => rows.sort((a, b) => a.sortOrder - b.sortOrder));
  },
});

export const saveLocation = mutation({
  args: {
    clubId:      v.id("clubs"),
    locationId:  v.optional(v.id("posLocations")),
    name:        v.string(),
    description: v.optional(v.string()),
    isActive:    v.boolean(),
    sortOrder:   v.number(),
  },
  handler: async (ctx, { clubId, locationId, name, description, isActive, sortOrder }) => {
    await assertAdmin(ctx, clubId);
    if (locationId) {
      await ctx.db.patch(locationId, { name, description, isActive, sortOrder });
      return locationId;
    }
    return ctx.db.insert("posLocations", {
      clubId, name, description, isActive, sortOrder,
      createdAt: new Date().toISOString(),
    });
  },
});

export const removeLocation = mutation({
  args: { locationId: v.id("posLocations") },
  handler: async (ctx, { locationId }) => {
    const loc = await ctx.db.get(locationId);
    if (!loc) throw new Error("Not found");
    await assertAdmin(ctx, loc.clubId);
    // Check no kiosks are assigned to this location before deleting
    const kiosks = await ctx.db
      .query("posKiosks")
      .withIndex("by_location", (q) => q.eq("locationId", locationId))
      .collect();
    if (kiosks.length > 0) {
      throw new Error("Remove all kiosks from this location before deleting it.");
    }
    await ctx.db.delete(locationId);
  },
});

// ============================================================================
// Kiosks
// ============================================================================

/** Fetch a single kiosk by ID — used by the PIN lock screen */
export const getKioskById = query({
  args: { kioskId: v.id("posKiosks") },
  handler: async (ctx, { kioskId }) => {
    return ctx.db.get(kioskId);
  },
});

export const listKiosks = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const kiosks = await ctx.db
      .query("posKiosks")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();
    // Join location name for display
    const locations = await ctx.db
      .query("posLocations")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();
    const locMap = new Map(locations.map((l) => [l._id, l.name]));
    return kiosks.map((k) => ({
      ...k,
      locationName: locMap.get(k.locationId) ?? "Unknown",
    }));
  },
});

export const saveKiosk = mutation({
  args: {
    clubId:     v.id("clubs"),
    kioskId:    v.optional(v.id("posKiosks")),
    locationId: v.id("posLocations"),
    name:       v.string(),
    pin:        v.optional(v.string()), // raw PIN — hashed server-side before storing
    isActive:   v.boolean(),
  },
  handler: async (ctx, { clubId, kioskId, locationId, name, pin, isActive }) => {
    await assertAdmin(ctx, clubId);

    // Hash the PIN if provided (simple SHA-256 via Web Crypto — available in Convex runtime)
    let pinHash: string | undefined = undefined;
    if (pin && pin.trim().length > 0) {
      const encoder = new TextEncoder();
      const data = encoder.encode(pin.trim());
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      pinHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    if (kioskId) {
      const patch: Record<string, unknown> = { locationId, name, isActive };
      // Only update pinHash if a new PIN was supplied
      if (pinHash !== undefined) patch.pinHash = pinHash;
      await ctx.db.patch(kioskId, patch);
      return kioskId;
    }
    return ctx.db.insert("posKiosks", {
      clubId, locationId, name, isActive,
      pinHash,
      createdAt: new Date().toISOString(),
    });
  },
});

export const removeKiosk = mutation({
  args: { kioskId: v.id("posKiosks") },
  handler: async (ctx, { kioskId }) => {
    const kiosk = await ctx.db.get(kioskId);
    if (!kiosk) throw new Error("Not found");
    await assertAdmin(ctx, kiosk.clubId);
    await ctx.db.delete(kioskId);
  },
});

// Verify a PIN against a kiosk's stored hash (used by lock screen)
export const verifyKioskPin = query({
  args: {
    kioskId: v.id("posKiosks"),
    pinHash: v.string(), // caller hashes PIN client-side before sending
  },
  handler: async (ctx, { kioskId, pinHash }) => {
    const kiosk = await ctx.db.get(kioskId);
    if (!kiosk) return false;
    return kiosk.pinHash === pinHash;
  },
});
