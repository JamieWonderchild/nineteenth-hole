import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Check if an event has already been processed, and if not, record it.
// Returns true if the event is new (should be processed), false if already seen.
export const checkAndRecord = mutation({
  args: {
    eventId: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processedWebhookEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    if (existing) {
      return false; // Already processed
    }

    await ctx.db.insert("processedWebhookEvents", {
      eventId: args.eventId,
      source: args.source,
      processedAt: new Date().toISOString(),
    });

    return true; // New event, proceed with processing
  },
});
