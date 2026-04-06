// convex/recordings.ts
// CRUD for recordings table — each recording is a child of a encounter.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Create a recording linked to a encounter
export const createRecording = mutation({
  args: {
    encounterId: v.id("encounters"),
    interactionId: v.optional(v.string()),
    transcript: v.optional(v.string()),
    facts: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      group: v.string(),
    }))),
    phase: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    // Determine orderIndex: count existing recordings
    const existing = await ctx.db
      .query("recordings")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const recordingId = await ctx.db.insert("recordings", {
      encounterId: args.encounterId,
      interactionId: args.interactionId,
      transcript: args.transcript,
      facts: args.facts,
      phase: args.phase,
      duration: args.duration,
      orderIndex: existing.length,
      createdAt: new Date().toISOString(),
    });

    // When a note recording is saved with real facts, trigger billing extraction
    if (args.phase === 'note' && args.facts && args.facts.length > 0 && encounter.orgId) {
      await ctx.db.patch(recordingId, { billingExtractionStatus: 'processing' as const });
      await ctx.scheduler.runAfter(0, api.billingExtraction.extractFromRecording, {
        encounterId: args.encounterId,
        recordingId,
        orgId: encounter.orgId,
        userId: encounter.providerId,
      });
    }

    return recordingId;
  },
});

// Get all recordings for a encounter, ordered by creation time
export const getByConsultation = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    return recordings.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  },
});

// Update a recording (transcript, facts, duration)
export const updateRecording = mutation({
  args: {
    id: v.id("recordings"),
    transcript: v.optional(v.string()),
    facts: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      group: v.string(),
    }))),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const recording = await ctx.db.get(args.id);
    if (!recording) {
      throw new Error("Recording not found");
    }

    const patch: Record<string, unknown> = {};
    if (args.transcript !== undefined) patch.transcript = args.transcript;
    if (args.facts !== undefined) patch.facts = args.facts;
    if (args.duration !== undefined) patch.duration = args.duration;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.id, patch);
    }

    return { success: true };
  },
});

// Update a single fact's text within a recording
export const updateFactText = mutation({
  args: {
    encounterId: v.id("encounters"),
    factId: v.string(),
    newText: v.string(),
  },
  handler: async (ctx, args) => {
    // Find all recordings for this encounter
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    // Find which recording contains this fact and update it
    for (const recording of recordings) {
      if (!recording.facts) continue;

      const factIndex = recording.facts.findIndex((f) => f.id === args.factId);
      if (factIndex >= 0) {
        const updatedFacts = [...recording.facts];
        updatedFacts[factIndex] = {
          ...updatedFacts[factIndex],
          text: args.newText,
        };

        await ctx.db.patch(recording._id, { facts: updatedFacts });
        return { success: true, recordingId: recording._id };
      }
    }

    throw new Error("Fact not found in any recording");
  },
});

// Delete a recording and its associated billing items
// Used when user clicks "Record Again" to discard auto-saved recording
export const deleteRecording = mutation({
  args: {
    id: v.id("recordings"),
    encounterId: v.optional(v.id("encounters")),
  },
  handler: async (ctx, args) => {
    const recording = await ctx.db.get(args.id);
    if (!recording) {
      throw new Error("Recording not found");
    }

    // Delete the recording
    await ctx.db.delete(args.id);

    // Delete billing items associated with this recording
    const billingItems = await ctx.db
      .query("billingItems")
      .withIndex("by_recording", (q) => q.eq("recordingId", args.id))
      .collect();

    for (const item of billingItems) {
      await ctx.db.delete(item._id);
    }

    // If encounterId provided, check if this was the last recording
    const encounterId = args.encounterId;
    if (encounterId) {
      const remainingRecordings = await ctx.db
        .query("recordings")
        .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
        .collect();

      // If no recordings left, reset encounter to draft status
      if (remainingRecordings.length === 0) {
        await ctx.db.patch(encounterId, {
          status: "draft",
        });
      }
    }

    return {
      success: true,
      deletedBillingItems: billingItems.length,
    };
  },
});
