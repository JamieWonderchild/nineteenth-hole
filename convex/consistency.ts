// convex/consistency.ts
// Comprehensive data consistency detection system
// Detects orphaned data and mismatches between Clerk and Convex

import { v } from "convex/values";
import { query, action } from "./_generated/server";
import { api } from "./_generated/api";

type Severity = "critical" | "warning" | "info";

interface DetectionResult {
  severity: Severity;
  count: number;
  samples: any[];
  message: string;
}

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
// CLERK SYNC ISSUES (actions - require Clerk API access)
// ============================================================================

// 1. Orphaned Clerk Orgs (already in admin.ts, but included here for completeness)
export const detectOrphanedClerkOrgs = action({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      return {
        severity: "critical",
        count: 0,
        samples: [],
        message: "CLERK_SECRET_KEY not configured",
      };
    }

    const clerkResponse = await fetch(
      "https://api.clerk.com/v1/organizations?limit=100",
      {
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!clerkResponse.ok) {
      return {
        severity: "critical",
        count: 0,
        samples: [],
        message: `Failed to fetch Clerk orgs: ${clerkResponse.status}`,
      };
    }

    const clerkData = (await clerkResponse.json()) as {
      data: Array<{ id: string; name: string; created_at: number }>;
    };

    const convexOrgs = await ctx.runQuery(api.organizations.getAllForAdmin, {});
    const convexClerkIds = new Set(convexOrgs.map((o) => o.clerkOrgId));

    const orphaned = clerkData.data.filter(
      (clerkOrg) => !convexClerkIds.has(clerkOrg.id)
    );

    return {
      severity: orphaned.length > 0 ? "critical" : "info",
      count: orphaned.length,
      samples: orphaned.slice(0, 5).map((org) => ({
        clerkOrgId: org.id,
        name: org.name,
        createdAt: new Date(org.created_at).toISOString(),
      })),
      message:
        orphaned.length > 0
          ? `${orphaned.length} Clerk org(s) exist without Convex records`
          : "All Clerk orgs have Convex records",
    };
  },
});

// 2. Orphaned Convex Orgs (Convex orgs with deleted Clerk org)
export const detectOrphanedConvexOrgs = action({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      return {
        severity: "warning",
        count: 0,
        samples: [],
        message: "CLERK_SECRET_KEY not configured",
      };
    }

    const convexOrgs = await ctx.runQuery(api.organizations.getAllForAdmin, {});

    // Fetch all Clerk orgs
    const clerkResponse = await fetch(
      "https://api.clerk.com/v1/organizations?limit=100",
      {
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!clerkResponse.ok) {
      return {
        severity: "warning",
        count: 0,
        samples: [],
        message: `Failed to fetch Clerk orgs: ${clerkResponse.status}`,
      };
    }

    const clerkData = (await clerkResponse.json()) as {
      data: Array<{ id: string }>;
    };

    const clerkOrgIds = new Set(clerkData.data.map((o) => o.id));

    const orphaned = convexOrgs.filter(
      (org) => org.clerkOrgId && !clerkOrgIds.has(org.clerkOrgId)
    );

    return {
      severity: orphaned.length > 0 ? "warning" : "info",
      count: orphaned.length,
      samples: orphaned.slice(0, 5).map((org) => ({
        _id: org._id,
        name: org.name,
        clerkOrgId: org.clerkOrgId,
      })),
      message:
        orphaned.length > 0
          ? `${orphaned.length} Convex org(s) reference deleted Clerk orgs`
          : "All Convex orgs have valid Clerk references",
    };
  },
});

// 3. Missing Memberships (Clerk members with no Convex membership)
export const detectMissingMemberships = action({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      return {
        severity: "warning",
        count: 0,
        samples: [],
        message: "CLERK_SECRET_KEY not configured",
      };
    }

    // Get all Convex orgs
    const convexOrgs = await ctx.runQuery(api.organizations.getAllForAdmin, {});

    const missing: Array<{
      orgName: string;
      clerkOrgId: string;
      userId: string;
      role: string;
    }> = [];

    // For each Convex org, check if Clerk members have Convex memberships
    for (const org of convexOrgs) {
      if (!org.clerkOrgId) continue;

      // Fetch Clerk org members
      const membersResponse = await fetch(
        `https://api.clerk.com/v1/organizations/${org.clerkOrgId}/memberships?limit=100`,
        {
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!membersResponse.ok) continue;

      const membersData = (await membersResponse.json()) as {
        data: Array<{
          public_user_data: { user_id: string };
          role: string;
        }>;
      };

      // Get Convex memberships for this org
      const convexMemberships = await ctx.runQuery(
        api.memberships.getByOrg,
        { orgId: org._id }
      );

      const convexUserIds = new Set(convexMemberships.map((m) => m.userId));

      // Find Clerk members without Convex memberships
      for (const member of membersData.data) {
        const userId = member.public_user_data.user_id;
        if (!convexUserIds.has(userId)) {
          missing.push({
            orgName: org.name,
            clerkOrgId: org.clerkOrgId,
            userId,
            role: member.role,
          });

          if (missing.length >= 5) break; // Limit samples
        }
      }

      if (missing.length >= 5) break;
    }

    return {
      severity: missing.length > 0 ? "warning" : "info",
      count: missing.length,
      samples: missing,
      message:
        missing.length > 0
          ? `${missing.length} Clerk member(s) missing Convex memberships`
          : "All Clerk members have Convex memberships",
    };
  },
});

// 4. Plan Mismatches (Clerk metadata.plan ≠ Convex org.plan)
export const detectPlanMismatches = action({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      return {
        severity: "info",
        count: 0,
        samples: [],
        message: "CLERK_SECRET_KEY not configured",
      };
    }

    const convexOrgs = await ctx.runQuery(api.organizations.getAllForAdmin, {});

    const mismatches: Array<{
      orgName: string;
      clerkOrgId: string;
      clerkPlan: string | undefined;
      convexPlan: string;
    }> = [];

    for (const org of convexOrgs) {
      if (!org.clerkOrgId) continue;

      // Fetch Clerk org to get metadata
      const clerkResponse = await fetch(
        `https://api.clerk.com/v1/organizations/${org.clerkOrgId}`,
        {
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!clerkResponse.ok) continue;

      const clerkOrg = (await clerkResponse.json()) as {
        public_metadata?: { plan?: string };
        private_metadata?: { plan?: string };
      };

      const clerkPlan =
        clerkOrg.public_metadata?.plan || clerkOrg.private_metadata?.plan;

      if (clerkPlan && clerkPlan !== org.plan) {
        mismatches.push({
          orgName: org.name,
          clerkOrgId: org.clerkOrgId,
          clerkPlan,
          convexPlan: org.plan,
        });

        if (mismatches.length >= 5) break;
      }
    }

    return {
      severity: mismatches.length > 0 ? "info" : "info",
      count: mismatches.length,
      samples: mismatches,
      message:
        mismatches.length > 0
          ? `${mismatches.length} org(s) have plan mismatches between Clerk and Convex`
          : "All org plans are synced",
    };
  },
});

// ============================================================================
// DATABASE INTEGRITY (queries - no Clerk API needed)
// ============================================================================

// 5. Orphaned Memberships
export const detectOrphanedMemberships = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const memberships = await ctx.db.query("memberships").collect();
    const orphaned: any[] = [];

    for (const membership of memberships) {
      const org = await ctx.db.get(membership.orgId);
      if (!org) {
        orphaned.push({
          _id: membership._id,
          userId: membership.userId,
          orgId: membership.orgId,
          role: membership.role,
        });

        if (orphaned.length >= 5) break;
      }
    }

    return {
      severity: orphaned.length > 0 ? "warning" : "info",
      count: orphaned.length,
      samples: orphaned,
      message:
        orphaned.length > 0
          ? `${orphaned.length} membership(s) reference non-existent orgs`
          : "All memberships reference valid orgs",
    };
  },
});

// 6. Orphaned Locations
export const detectOrphanedLocations = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const locations = await ctx.db.query("locations").collect();
    const orphaned: any[] = [];

    for (const location of locations) {
      const org = await ctx.db.get(location.orgId);
      if (!org) {
        orphaned.push({
          _id: location._id,
          name: location.name,
          orgId: location.orgId,
        });

        if (orphaned.length >= 5) break;
      }
    }

    return {
      severity: orphaned.length > 0 ? "warning" : "info",
      count: orphaned.length,
      samples: orphaned,
      message:
        orphaned.length > 0
          ? `${orphaned.length} location(s) reference non-existent orgs`
          : "All locations reference valid orgs",
    };
  },
});

// 7. Orphaned Patients
export const detectOrphanedPatients = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const patients = await ctx.db.query("patients").collect();
    const orphaned: any[] = [];

    for (const patient of patients) {
      if (!patient.orgId) continue; // Skip old patients without orgId

      const org = await ctx.db.get(patient.orgId);
      if (!org) {
        orphaned.push({
          _id: patient._id,
          name: patient.name,
          orgId: patient.orgId,
        });

        if (orphaned.length >= 5) break;
      }
    }

    return {
      severity: orphaned.length > 0 ? "warning" : "info",
      count: orphaned.length,
      samples: orphaned,
      message:
        orphaned.length > 0
          ? `${orphaned.length} patient(s) reference non-existent orgs`
          : "All patients reference valid orgs",
    };
  },
});

// 8. Orphaned Encounters
export const detectOrphanedConsultations = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const encounters = await ctx.db.query("encounters").collect();
    const orphaned: any[] = [];

    for (const encounter of encounters) {
      let isOrphaned = false;
      let reason = "";

      // Check orgId
      if (encounter.orgId) {
        const org = await ctx.db.get(encounter.orgId);
        if (!org) {
          isOrphaned = true;
          reason = "org not found";
        }
      }

      // Check patientId
      if (!isOrphaned && encounter.patientId) {
        const patient = await ctx.db.get(encounter.patientId);
        if (!patient) {
          isOrphaned = true;
          reason = "patient not found";
        }
      }

      if (isOrphaned) {
        orphaned.push({
          _id: encounter._id,
          orgId: encounter.orgId,
          patientId: encounter.patientId,
          reason,
        });

        if (orphaned.length >= 5) break;
      }
    }

    return {
      severity: orphaned.length > 0 ? "warning" : "info",
      count: orphaned.length,
      samples: orphaned,
      message:
        orphaned.length > 0
          ? `${orphaned.length} encounter(s) have orphaned references`
          : "All encounters reference valid orgs/patients",
    };
  },
});

// 9. Orphaned Companion Sessions
export const detectOrphanedCompanionSessions = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const sessions = await ctx.db.query("companionSessions").collect();
    const orphaned: any[] = [];

    for (const session of sessions) {
      if (!session.orgId) continue;

      const org = await ctx.db.get(session.orgId);
      if (!org) {
        orphaned.push({
          _id: session._id,
          orgId: session.orgId,
          encounterId: session.encounterId,
        });

        if (orphaned.length >= 5) break;
      }
    }

    return {
      severity: orphaned.length > 0 ? "warning" : "info",
      count: orphaned.length,
      samples: orphaned,
      message:
        orphaned.length > 0
          ? `${orphaned.length} companion session(s) reference non-existent orgs`
          : "All companion sessions reference valid orgs",
    };
  },
});

// 10. Orphaned Follow-Ups
export const detectOrphanedFollowUps = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const followUps = await ctx.db.query("followUps").collect();
    const orphaned: any[] = [];

    for (const followUp of followUps) {
      if (!followUp.orgId) continue;

      const org = await ctx.db.get(followUp.orgId);
      if (!org) {
        orphaned.push({
          _id: followUp._id,
          orgId: followUp.orgId,
        });

        if (orphaned.length >= 5) break;
      }
    }

    return {
      severity: orphaned.length > 0 ? "info" : "info",
      count: orphaned.length,
      samples: orphaned,
      message:
        orphaned.length > 0
          ? `${orphaned.length} follow-up(s) reference non-existent orgs`
          : "All follow-ups reference valid orgs",
    };
  },
});

// 11. Orphaned Usage Records
export const detectOrphanedUsageRecords = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const usageRecords = await ctx.db.query("usageRecords").collect();
    const orphaned: any[] = [];

    for (const record of usageRecords) {
      const org = await ctx.db.get(record.orgId);
      if (!org) {
        orphaned.push({
          _id: record._id,
          orgId: record.orgId,
          type: record.type,
        });

        if (orphaned.length >= 5) break;
      }
    }

    return {
      severity: orphaned.length > 0 ? "info" : "info",
      count: orphaned.length,
      samples: orphaned,
      message:
        orphaned.length > 0
          ? `${orphaned.length} usage record(s) reference non-existent orgs`
          : "All usage records reference valid orgs",
    };
  },
});

// 12. Orphaned Evidence Files
export const detectOrphanedEvidenceFiles = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const evidenceFiles = await ctx.db.query("evidenceFiles").collect();
    const orphaned: any[] = [];

    for (const file of evidenceFiles) {
      const encounter = await ctx.db.get(file.encounterId);
      if (!encounter) {
        orphaned.push({
          _id: file._id,
          encounterId: file.encounterId,
          fileName: file.fileName,
        });

        if (orphaned.length >= 5) break;
      }
    }

    return {
      severity: orphaned.length > 0 ? "info" : "info",
      count: orphaned.length,
      samples: orphaned,
      message:
        orphaned.length > 0
          ? `${orphaned.length} evidence file(s) reference non-existent encounters`
          : "All evidence files reference valid encounters",
    };
  },
});

// 13. Orphaned Recordings
export const detectOrphanedRecordings = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<DetectionResult> => {
    assertSuperadmin(args.callerEmail);

    const recordings = await ctx.db.query("recordings").collect();
    const orphaned: any[] = [];

    for (const recording of recordings) {
      const encounter = await ctx.db.get(recording.encounterId);
      if (!encounter) {
        orphaned.push({
          _id: recording._id,
          encounterId: recording.encounterId,
          phase: recording.phase,
        });

        if (orphaned.length >= 5) break;
      }
    }

    return {
      severity: orphaned.length > 0 ? "info" : "info",
      count: orphaned.length,
      samples: orphaned,
      message:
        orphaned.length > 0
          ? `${orphaned.length} recording(s) reference non-existent encounters`
          : "All recordings reference valid encounters",
    };
  },
});
