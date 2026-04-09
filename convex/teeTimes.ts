import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Auth helpers ─────────────────────────────────────────────────────────────

async function assertClubMember(ctx: MutationCtx, clubId: Id<"clubs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return identity;
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", identity.subject))
    .unique();
  if (!member || member.status !== "active") throw new Error("Not a club member");
  return identity;
}

async function assertClubAdmin(ctx: MutationCtx, clubId: Id<"clubs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return identity;
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", identity.subject))
    .unique();
  if (!member || member.role !== "admin") throw new Error("Not authorised");
  return identity;
}

// ── Queries ──────────────────────────────────────────────────────────────────

// All slots for a club on a given date, with their bookings
export const listSlotsForDate = query({
  args: { clubId: v.id("clubs"), date: v.string() },
  handler: async (ctx, { clubId, date }) => {
    const slots = await ctx.db
      .query("teeTimeSlots")
      .withIndex("by_club_and_date", q => q.eq("clubId", clubId).eq("date", date))
      .collect();

    const result = await Promise.all(slots.map(async slot => {
      const bookings = await ctx.db
        .query("teeTimeBookings")
        .withIndex("by_slot", q => q.eq("slotId", slot._id))
        .filter(q => q.eq(q.field("status"), "confirmed"))
        .collect();
      const takenPlayers = bookings.reduce((sum, b) => sum + b.playerCount, 0);
      return { ...slot, bookings, takenPlayers, available: Math.max(0, slot.maxPlayers - takenPlayers) };
    }));

    return result.sort((a, b) => a.time.localeCompare(b.time));
  },
});

// All bookings for a club on a given date (admin view)
export const listBookingsForDate = query({
  args: { clubId: v.id("clubs"), date: v.string() },
  handler: async (ctx, { clubId, date }) => {
    return ctx.db
      .query("teeTimeBookings")
      .withIndex("by_club_and_date", q => q.eq("clubId", clubId).eq("date", date))
      .filter(q => q.eq(q.field("status"), "confirmed"))
      .collect();
  },
});

// A member's upcoming confirmed bookings
export const listMyBookings = query({
  args: { clubId: v.id("clubs"), userId: v.string() },
  handler: async (ctx, { clubId, userId }) => {
    const today = new Date().toISOString().split("T")[0];
    const bookings = await ctx.db
      .query("teeTimeBookings")
      .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", userId))
      .filter(q => q.eq(q.field("status"), "confirmed"))
      .collect();
    return bookings.filter(b => b.date >= today).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
  },
});

// Dates that have at least one slot for a club (for calendar)
export const listAvailableDates = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const today = new Date().toISOString().split("T")[0];
    const slots = await ctx.db
      .query("teeTimeSlots")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .filter(q => q.gte(q.field("date"), today))
      .collect();
    const dates = [...new Set(slots.map(s => s.date))].sort();
    return dates;
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

// Admin: generate slots for a date range
export const generateSlots = mutation({
  args: {
    clubId: v.id("clubs"),
    dates: v.array(v.string()),   // ["2026-04-12", "2026-04-13", ...]
    firstTime: v.string(),        // "07:00"
    lastTime: v.string(),         // "18:00"
    intervalMinutes: v.number(),  // 9
    maxPlayers: v.number(),       // 4
  },
  handler: async (ctx, args) => {
    await assertClubAdmin(ctx, args.clubId);
    const now = new Date().toISOString();
    let created = 0;

    for (const date of args.dates) {
      const [fh, fm] = args.firstTime.split(":").map(Number);
      const [lh, lm] = args.lastTime.split(":").map(Number);
      let minutes = fh * 60 + fm;
      const lastMinutes = lh * 60 + lm;

      while (minutes <= lastMinutes) {
        const h = Math.floor(minutes / 60).toString().padStart(2, "0");
        const m = (minutes % 60).toString().padStart(2, "0");
        const time = `${h}:${m}`;

        // Skip if slot already exists
        const existing = await ctx.db
          .query("teeTimeSlots")
          .withIndex("by_club_and_date", q => q.eq("clubId", args.clubId).eq("date", date))
          .filter(q => q.eq(q.field("time"), time))
          .first();

        if (!existing) {
          await ctx.db.insert("teeTimeSlots", {
            clubId: args.clubId,
            date,
            time,
            maxPlayers: args.maxPlayers,
            createdAt: now,
            updatedAt: now,
          });
          created++;
        }
        minutes += args.intervalMinutes;
      }
    }
    return created;
  },
});

// Member: book a slot
export const bookSlot = mutation({
  args: {
    slotId: v.id("teeTimeSlots"),
    clubId: v.id("clubs"),
    playerCount: v.number(),
    notes: v.optional(v.string()),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await assertClubMember(ctx, args.clubId);
    const slot = await ctx.db.get(args.slotId);
    if (!slot) throw new Error("Slot not found");
    if (slot.isBlocked) throw new Error("This slot is not available");

    // Check capacity
    const existing = await ctx.db
      .query("teeTimeBookings")
      .withIndex("by_slot", q => q.eq("slotId", args.slotId))
      .filter(q => q.eq(q.field("status"), "confirmed"))
      .collect();
    const takenPlayers = existing.reduce((sum, b) => sum + b.playerCount, 0);
    if (takenPlayers + args.playerCount > slot.maxPlayers) {
      throw new Error(`Only ${slot.maxPlayers - takenPlayers} player spot${slot.maxPlayers - takenPlayers === 1 ? "" : "s"} remaining`);
    }

    // One booking per user per slot
    const myBooking = existing.find(b => b.userId === identity.subject);
    if (myBooking) throw new Error("You already have a booking in this slot");

    const now = new Date().toISOString();
    return ctx.db.insert("teeTimeBookings", {
      clubId: args.clubId,
      slotId: args.slotId,
      date: slot.date,
      time: slot.time,
      userId: identity.subject,
      displayName: args.displayName,
      playerCount: args.playerCount,
      notes: args.notes,
      status: "confirmed",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Member or admin: cancel a booking
export const cancelBooking = mutation({
  args: { bookingId: v.id("teeTimeBookings") },
  handler: async (ctx, { bookingId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const booking = await ctx.db.get(bookingId);
    if (!booking) throw new Error("Booking not found");

    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    const isOwner = booking.userId === identity.subject;

    if (!isSuperAdmin && !isOwner) {
      // Check if caller is club admin
      const member = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", booking.clubId).eq("userId", identity.subject))
        .unique();
      if (!member || member.role !== "admin") throw new Error("Not authorised");
    }

    await ctx.db.patch(bookingId, { status: "cancelled", updatedAt: new Date().toISOString() });
  },
});

// Admin: block or unblock a slot
export const setSlotBlocked = mutation({
  args: { slotId: v.id("teeTimeSlots"), blocked: v.boolean() },
  handler: async (ctx, { slotId, blocked }) => {
    const slot = await ctx.db.get(slotId);
    if (!slot) throw new Error("Slot not found");
    await assertClubAdmin(ctx, slot.clubId);
    await ctx.db.patch(slotId, { isBlocked: blocked, updatedAt: new Date().toISOString() });
  },
});

// Admin: delete all slots for a date (and cancel their bookings)
export const deleteSlotsForDate = mutation({
  args: { clubId: v.id("clubs"), date: v.string() },
  handler: async (ctx, { clubId, date }) => {
    await assertClubAdmin(ctx, clubId);
    const slots = await ctx.db
      .query("teeTimeSlots")
      .withIndex("by_club_and_date", q => q.eq("clubId", clubId).eq("date", date))
      .collect();
    const now = new Date().toISOString();
    for (const slot of slots) {
      const bookings = await ctx.db
        .query("teeTimeBookings")
        .withIndex("by_slot", q => q.eq("slotId", slot._id))
        .collect();
      for (const b of bookings) await ctx.db.patch(b._id, { status: "cancelled", updatedAt: now });
      await ctx.db.delete(slot._id);
    }
    return slots.length;
  },
});
