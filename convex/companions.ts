// convex/companions.ts
// Companion session queries and mutations for the owner-facing AI companion
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a companion session for a encounter
export const createSession = mutation({
  args: {
    encounterId: v.id("encounters"),
    accessToken: v.string(),
    context: v.object({
      patientName: v.string(),
      age: v.optional(v.string()),
      weight: v.optional(v.string()),
      visitSummary: v.string(),
      visitDate: v.string(),
      diagnosis: v.optional(v.string()),
      treatmentPlan: v.optional(v.string()),
      medications: v.optional(v.array(v.object({
        name: v.string(),
        dose: v.string(),
        frequency: v.string(),
        duration: v.string(),
        instructions: v.string(),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
      }))),
      followUpDate: v.optional(v.string()),
      followUpReason: v.optional(v.string()),
      homeCareInstructions: v.optional(v.array(v.string())),
      warningSignsToWatch: v.optional(v.array(v.string())),
      dietaryInstructions: v.optional(v.string()),
      activityRestrictions: v.optional(v.string()),
      clinicName: v.optional(v.string()),
      clinicPhone: v.optional(v.string()),
      emergencyPhone: v.optional(v.string()),
      chargedServices: v.optional(v.array(v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      }))),
    }),
    expiresAt: v.string(),
  },
  handler: async (ctx, args) => {
    // Get encounter to find patient and provider
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    const timestamp = new Date().toISOString();

    const sessionId = await ctx.db.insert("companionSessions", {
      encounterId: args.encounterId,
      patientId: encounter.patientId,
      providerId: encounter.providerId,
      orgId: encounter.orgId,
      accessToken: args.accessToken,
      context: args.context,
      isActive: true,
      expiresAt: args.expiresAt,
      messageCount: 0,
      createdAt: timestamp,
    });

    // Link session to encounter
    await ctx.db.patch(args.encounterId, {
      companionSessionId: sessionId,
      updatedAt: timestamp,
    });

    return sessionId;
  },
});

// Get a session by access token (public - no auth needed)
export const getByAccessToken = query({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("companionSessions")
      .withIndex("by_access_token", (q) => q.eq("accessToken", args.accessToken))
      .first();

    if (!session) return null;

    // Check expiry
    if (new Date(session.expiresAt) < new Date()) {
      return null;
    }

    if (!session.isActive) return null;

    return session;
  },
});

// Get session by encounter (for provider to see if companion exists)
export const getByConsultation = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companionSessions")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .first();
  },
});

// Increment message count and update last accessed
export const recordMessage = mutation({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("companionSessions")
      .withIndex("by_access_token", (q) => q.eq("accessToken", args.accessToken))
      .first();

    if (!session) throw new Error("Session not found");

    await ctx.db.patch(session._id, {
      messageCount: session.messageCount + 1,
      lastAccessedAt: new Date().toISOString(),
    });
  },
});

// Store Corti agent and context IDs on a session (called after first message creates the agent)
export const setCortiIds = mutation({
  args: {
    accessToken: v.string(),
    cortiAgentId: v.string(),
    cortiContextId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("companionSessions")
      .withIndex("by_access_token", (q) => q.eq("accessToken", args.accessToken))
      .first();

    if (!session) throw new Error("Session not found");

    await ctx.db.patch(session._id, {
      cortiAgentId: args.cortiAgentId,
      cortiContextId: args.cortiContextId,
    });
  },
});

// Rebuild companion context from latest encounter data and bump contextVersion
export const updateSessionContext = mutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("companionSessions")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .first();
    if (!session) return null;

    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;

    const patient = await ctx.db.get(encounter.patientId);
    if (!patient) return null;

    // Build visit summary from generated documents if available, else transcript
    let visitSummary = session.context.visitSummary;
    const docs = encounter.generatedDocuments;
    if (docs?.afterVisitSummary?.sections) {
      visitSummary = docs.afterVisitSummary.sections
        .map((s) => `${s.title}: ${s.content}`)
        .join("\n\n");
    } else if (docs?.soapNote?.sections) {
      visitSummary = docs.soapNote.sections
        .map((s) => `${s.title}: ${s.content}`)
        .join("\n\n");
    } else if (encounter.transcription) {
      visitSummary = encounter.transcription.slice(0, 2000);
    }

    // Build medications from diagnosis result if available
    let medications = session.context.medications;
    if (encounter.diagnosisResult?.treatments?.medications) {
      medications = encounter.diagnosisResult.treatments.medications.map((m) => ({
        name: m.drug,
        dose: m.dose,
        frequency: m.frequency,
        duration: m.duration,
        instructions: `${m.route} ${m.frequency}`,
      }));
    }

    // Get follow-ups
    const followUps = await ctx.db
      .query("followUps")
      .filter((q) => q.eq(q.field("encounterId"), args.encounterId))
      .collect();
    const nextFollowUp = followUps.find((f) => f.status !== "completed");

    // Extract warning signs from discharge instructions if available
    let warningSignsToWatch = session.context.warningSignsToWatch;
    if (docs?.dischargeInstructions?.sections) {
      const warningSection = docs.dischargeInstructions.sections.find(
        (s) =>
          s.key.toLowerCase().includes("warning") ||
          s.title.toLowerCase().includes("warning")
      );
      if (warningSection) {
        warningSignsToWatch = warningSection.content
          .split("\n")
          .filter(Boolean);
      }
    }

    const updatedContext = {
      ...session.context,
      patientName: patient.name,
      age: patient.age,
      weight: patient.weight,
      visitSummary,
      diagnosis: encounter.diagnosis || session.context.diagnosis,
      treatmentPlan: encounter.treatment || session.context.treatmentPlan,
      medications,
      followUpDate: nextFollowUp?.scheduledDate || session.context.followUpDate,
      followUpReason: nextFollowUp?.reason || session.context.followUpReason,
      warningSignsToWatch,
    };

    const newVersion = (session.contextVersion || 0) + 1;
    await ctx.db.patch(session._id, {
      context: updatedContext,
      contextVersion: newVersion,
    });

    return { contextVersion: newVersion };
  },
});

// Deactivate a session (provider can revoke access)
export const deactivateSession = mutation({
  args: {
    sessionId: v.id("companionSessions"),
    providerId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.providerId !== args.providerId) throw new Error("Not authorized");

    await ctx.db.patch(args.sessionId, { isActive: false });
    return { success: true };
  },
});

// List all active companion sessions for a provider
export const listByVet = query({
  args: { providerId: v.string() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("companionSessions")
      .filter((q) =>
        q.and(
          q.eq(q.field("providerId"), args.providerId),
          q.eq(q.field("isActive"), true)
        )
      )
      .collect();

    // Filter out expired sessions
    const now = new Date();
    return sessions.filter((s) => new Date(s.expiresAt) > now);
  },
});

// List active companion sessions by org
export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("companionSessions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const now = new Date();
    return sessions.filter((s) => new Date(s.expiresAt) > now);
  },
});
