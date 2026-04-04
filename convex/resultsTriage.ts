import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Create a new lab result and immediately trigger async triage
 */
export const createLabResult = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    orgId: v.id("organizations"),
    providerId: v.string(),
    testName: v.string(),
    resultValue: v.string(),
    referenceRange: v.optional(v.string()),
    units: v.optional(v.string()),
    collectedAt: v.optional(v.string()),
    entryMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    const labResultId = await ctx.db.insert("labResults", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      orgId: args.orgId,
      providerId: args.providerId,
      testName: args.testName,
      resultValue: args.resultValue,
      referenceRange: args.referenceRange,
      units: args.units,
      collectedAt: args.collectedAt,
      resultedAt: timestamp,
      triageStatus: 'pending',
      entryMethod: args.entryMethod ?? 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Schedule async triage — does not block the UI
    await ctx.scheduler.runAfter(0, api.resultsTriage.triageResult, {
      labResultId,
    });

    return labResultId;
  },
});

/**
 * Action: Run AI triage on a lab result and save the output
 */
export const triageResult = action({
  args: {
    labResultId: v.id("labResults"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    console.log(`[ResultsTriage] Triaging result ${args.labResultId}`);

    try {
      // Fetch the result + context
      const data = await ctx.runMutation(
        internal.resultsTriage.getResultWithContext,
        { labResultId: args.labResultId }
      );

      if (!data) {
        return { success: false, error: 'Lab result not found' };
      }

      const apiUrl = process.env.SITE_URL || 'https://healthplatform.com';
      const response = await fetch(`${apiUrl}/api/corti/triage-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testName: data.testName,
          resultValue: data.resultValue,
          referenceRange: data.referenceRange,
          units: data.units,
          patientInfo: data.patientInfo,
          encounterFacts: data.encounterFacts,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ResultsTriage] API error:', errorText.substring(0, 300));
        return { success: false, error: `API error: ${response.status}` };
      }

      const { triage } = await response.json();

      if (!triage) {
        return { success: false, error: 'Invalid triage response' };
      }

      await ctx.runMutation(internal.resultsTriage.saveTriageOutput, {
        labResultId: args.labResultId,
        urgency: triage.urgency,
        urgencyReason: triage.urgencyReason,
        patientNotificationDraft: triage.patientNotificationDraft,
        suggestedFollowUp: triage.suggestedFollowUp,
      });

      console.log(`[ResultsTriage] Triaged as ${triage.urgency}`);
      return { success: true };

    } catch (error) {
      console.error('[ResultsTriage] Fatal error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});

/**
 * Internal: Fetch lab result with patient and encounter context
 */
export const getResultWithContext = internalMutation({
  args: { labResultId: v.id("labResults") },
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.labResultId);
    if (!result) return null;

    const patient = await ctx.db.get(result.patientId);
    const patientInfo = patient
      ? { name: patient.name, age: patient.age ?? undefined, sex: patient.sex ?? undefined }
      : {};

    // Get encounter facts for context
    const encounter = await ctx.db.get(result.encounterId);
    let encounterFacts: Array<{ id: string; text: string; group: string }> = [];

    if (encounter?.factReconciliation) {
      for (const rf of encounter.factReconciliation.reconciledFacts) {
        encounterFacts.push({ id: rf.factId, text: rf.text, group: rf.group });
      }
    } else {
      const recordings = await ctx.db
        .query("recordings")
        .withIndex("by_encounter", q => q.eq("encounterId", result.encounterId))
        .collect();
      for (const rec of recordings) {
        for (const f of rec.facts ?? []) {
          encounterFacts.push({ id: f.id, text: f.text, group: f.group });
        }
      }
    }

    return {
      testName: result.testName,
      resultValue: result.resultValue,
      referenceRange: result.referenceRange,
      units: result.units,
      patientInfo,
      encounterFacts,
    };
  },
});

/**
 * Internal: Persist triage output to the lab result record
 */
export const saveTriageOutput = internalMutation({
  args: {
    labResultId: v.id("labResults"),
    urgency: v.string(),
    urgencyReason: v.string(),
    patientNotificationDraft: v.string(),
    suggestedFollowUp: v.string(),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();
    await ctx.db.patch(args.labResultId, {
      urgency: args.urgency,
      urgencyReason: args.urgencyReason,
      patientNotificationDraft: args.patientNotificationDraft,
      suggestedFollowUp: args.suggestedFollowUp,
      triageStatus: 'triaged',
      updatedAt: timestamp,
    });
  },
});

/**
 * Move a result to 'reviewed' status
 */
export const markReviewed = mutation({
  args: { labResultId: v.id("labResults") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.labResultId, {
      triageStatus: 'reviewed',
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Mark the patient notification as sent
 */
export const approveNotification = mutation({
  args: { labResultId: v.id("labResults") },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();
    await ctx.db.patch(args.labResultId, {
      notificationSent: true,
      notificationSentAt: timestamp,
      triageStatus: 'actioned',
      updatedAt: timestamp,
    });
  },
});

/**
 * Accept the suggested follow-up action
 */
export const acceptFollowUp = mutation({
  args: { labResultId: v.id("labResults") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.labResultId, {
      followUpAccepted: true,
      triageStatus: 'actioned',
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Get all lab results for a specific encounter
 */
export const getResultsByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("labResults")
      .withIndex("by_encounter", q => q.eq("encounterId", args.encounterId))
      .order("desc")
      .collect();
  },
});

/**
 * Get all pending/triaged results for the org (provider inbox view)
 */
export const getPendingResultsByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("labResults")
      .withIndex("by_org_triage_status", q =>
        q.eq("orgId", args.orgId).eq("triageStatus", "pending")
      )
      .order("desc")
      .collect();

    const triaged = await ctx.db
      .query("labResults")
      .withIndex("by_org_triage_status", q =>
        q.eq("orgId", args.orgId).eq("triageStatus", "triaged")
      )
      .order("desc")
      .collect();

    // Sort all by urgency: critical first, then high, normal, low
    const urgencyOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    return [...pending, ...triaged].sort((a, b) => {
      const aOrder = urgencyOrder[a.urgency ?? 'normal'] ?? 2;
      const bOrder = urgencyOrder[b.urgency ?? 'normal'] ?? 2;
      return aOrder - bOrder;
    });
  },
});
