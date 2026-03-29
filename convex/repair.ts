// convex/repair.ts
// Repair mutations for data consistency issues
// All repairs support dry-run mode for safe preview

import { v } from "convex/values";
import { mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function assertSuperadmin(callerEmail: string) {
  const allowed = (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.includes(callerEmail.toLowerCase())) {
    throw new Error("Forbidden: not a superadmin");
  }
}

// ============================================================================
// CLERK SYNC REPAIRS (handled in admin.ts)
// ============================================================================

// repairOrphanedClerkOrg - already in admin.ts
// repairOrphanedConvexOrg - delete or unlink Convex org
// repairMissingMembership - create missing membership
// repairPlanMismatch - sync plan from Clerk metadata

// ============================================================================
// DATABASE INTEGRITY REPAIRS
// ============================================================================

// Clean Orphaned Memberships
export const cleanOrphanedMemberships = mutation({
  args: {
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const memberships = await ctx.db.query("memberships").collect();
    const toDelete: Array<{
      _id: Id<"memberships">;
      userId: string;
      orgId: Id<"organizations">;
    }> = [];

    for (const membership of memberships) {
      const org = await ctx.db.get(membership.orgId);
      if (!org) {
        toDelete.push({
          _id: membership._id,
          userId: membership.userId,
          orgId: membership.orgId,
        });

        if (args.limit && toDelete.length >= args.limit) break;
      }
    }

    if (args.dryRun) {
      return {
        dryRun: true,
        count: toDelete.length,
        preview: toDelete,
      };
    }

    // Actually delete
    for (const item of toDelete) {
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      deleted: toDelete.length,
      items: toDelete,
    };
  },
});

// Clean Orphaned Locations
export const cleanOrphanedLocations = mutation({
  args: {
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const locations = await ctx.db.query("locations").collect();
    const toDelete: Array<{
      _id: Id<"locations">;
      name: string;
      orgId: Id<"organizations">;
    }> = [];

    for (const location of locations) {
      const org = await ctx.db.get(location.orgId);
      if (!org) {
        toDelete.push({
          _id: location._id,
          name: location.name,
          orgId: location.orgId,
        });

        if (args.limit && toDelete.length >= args.limit) break;
      }
    }

    if (args.dryRun) {
      return {
        dryRun: true,
        count: toDelete.length,
        preview: toDelete,
      };
    }

    for (const item of toDelete) {
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      deleted: toDelete.length,
      items: toDelete,
    };
  },
});

// Clean Orphaned Patients
export const cleanOrphanedPatients = mutation({
  args: {
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const patients = await ctx.db.query("patients").collect();
    const toDelete: Array<{
      _id: Id<"patients">;
      name: string;
      orgId?: Id<"organizations">;
    }> = [];

    for (const patient of patients) {
      if (!patient.orgId) continue;

      const org = await ctx.db.get(patient.orgId);
      if (!org) {
        toDelete.push({
          _id: patient._id,
          name: patient.name,
          orgId: patient.orgId,
        });

        if (args.limit && toDelete.length >= args.limit) break;
      }
    }

    if (args.dryRun) {
      return {
        dryRun: true,
        count: toDelete.length,
        preview: toDelete,
      };
    }

    for (const item of toDelete) {
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      deleted: toDelete.length,
      items: toDelete,
    };
  },
});

// Clean Orphaned Encounters
export const cleanOrphanedConsultations = mutation({
  args: {
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const encounters = await ctx.db.query("encounters").collect();
    const toDelete: Array<{
      _id: Id<"encounters">;
      orgId?: Id<"organizations">;
      patientId?: Id<"patients">;
      reason: string;
    }> = [];

    for (const encounter of encounters) {
      let shouldDelete = false;
      let reason = "";

      if (encounter.orgId) {
        const org = await ctx.db.get(encounter.orgId);
        if (!org) {
          shouldDelete = true;
          reason = "org not found";
        }
      }

      if (!shouldDelete && encounter.patientId) {
        const patient = await ctx.db.get(encounter.patientId);
        if (!patient) {
          shouldDelete = true;
          reason = "patient not found";
        }
      }

      if (shouldDelete) {
        toDelete.push({
          _id: encounter._id,
          orgId: encounter.orgId,
          patientId: encounter.patientId,
          reason,
        });

        if (args.limit && toDelete.length >= args.limit) break;
      }
    }

    if (args.dryRun) {
      return {
        dryRun: true,
        count: toDelete.length,
        preview: toDelete,
      };
    }

    for (const item of toDelete) {
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      deleted: toDelete.length,
      items: toDelete,
    };
  },
});

// Clean Orphaned Companion Sessions
export const cleanOrphanedCompanionSessions = mutation({
  args: {
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const sessions = await ctx.db.query("companionSessions").collect();
    const toDelete: Array<{
      _id: Id<"companionSessions">;
      orgId?: Id<"organizations">;
    }> = [];

    for (const session of sessions) {
      if (!session.orgId) continue;

      const org = await ctx.db.get(session.orgId);
      if (!org) {
        toDelete.push({
          _id: session._id,
          orgId: session.orgId,
        });

        if (args.limit && toDelete.length >= args.limit) break;
      }
    }

    if (args.dryRun) {
      return {
        dryRun: true,
        count: toDelete.length,
        preview: toDelete,
      };
    }

    for (const item of toDelete) {
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      deleted: toDelete.length,
      items: toDelete,
    };
  },
});

// Clean Orphaned Follow-Ups
export const cleanOrphanedFollowUps = mutation({
  args: {
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const followUps = await ctx.db.query("followUps").collect();
    const toDelete: Array<{
      _id: Id<"followUps">;
      orgId?: Id<"organizations">;
    }> = [];

    for (const followUp of followUps) {
      if (!followUp.orgId) continue;

      const org = await ctx.db.get(followUp.orgId);
      if (!org) {
        toDelete.push({
          _id: followUp._id,
          orgId: followUp.orgId,
        });

        if (args.limit && toDelete.length >= args.limit) break;
      }
    }

    if (args.dryRun) {
      return {
        dryRun: true,
        count: toDelete.length,
        preview: toDelete,
      };
    }

    for (const item of toDelete) {
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      deleted: toDelete.length,
      items: toDelete,
    };
  },
});

// Clean Orphaned Usage Records
export const cleanOrphanedUsageRecords = mutation({
  args: {
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const records = await ctx.db.query("usageRecords").collect();
    const toDelete: Array<{
      _id: Id<"usageRecords">;
      orgId: Id<"organizations">;
      type: string;
    }> = [];

    for (const record of records) {
      const org = await ctx.db.get(record.orgId);
      if (!org) {
        toDelete.push({
          _id: record._id,
          orgId: record.orgId,
          type: record.type,
        });

        if (args.limit && toDelete.length >= args.limit) break;
      }
    }

    if (args.dryRun) {
      return {
        dryRun: true,
        count: toDelete.length,
        preview: toDelete,
      };
    }

    for (const item of toDelete) {
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      deleted: toDelete.length,
      items: toDelete,
    };
  },
});

// Clean Orphaned Evidence Files
export const cleanOrphanedEvidenceFiles = mutation({
  args: {
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const files = await ctx.db.query("evidenceFiles").collect();
    const toDelete: Array<{
      _id: Id<"evidenceFiles">;
      encounterId: Id<"encounters">;
      fileName: string;
    }> = [];

    for (const file of files) {
      const encounter = await ctx.db.get(file.encounterId);
      if (!encounter) {
        toDelete.push({
          _id: file._id,
          encounterId: file.encounterId,
          fileName: file.fileName,
        });

        if (args.limit && toDelete.length >= args.limit) break;
      }
    }

    if (args.dryRun) {
      return {
        dryRun: true,
        count: toDelete.length,
        preview: toDelete,
      };
    }

    for (const item of toDelete) {
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      deleted: toDelete.length,
      items: toDelete,
    };
  },
});

// Clean Orphaned Recordings
export const cleanOrphanedRecordings = mutation({
  args: {
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const recordings = await ctx.db.query("recordings").collect();
    const toDelete: Array<{
      _id: Id<"recordings">;
      encounterId: Id<"encounters">;
      phase?: string;
    }> = [];

    for (const recording of recordings) {
      const encounter = await ctx.db.get(recording.encounterId);
      if (!encounter) {
        toDelete.push({
          _id: recording._id,
          encounterId: recording.encounterId,
          phase: recording.phase,
        });

        if (args.limit && toDelete.length >= args.limit) break;
      }
    }

    if (args.dryRun) {
      return {
        dryRun: true,
        count: toDelete.length,
        preview: toDelete,
      };
    }

    for (const item of toDelete) {
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      deleted: toDelete.length,
      items: toDelete,
    };
  },
});

// ============================================================================
// BATCH REPAIRS
// ============================================================================

// Note: Batch repair removed - Convex actions cannot call mutations.
// Use individual repair functions directly from the admin UI.
