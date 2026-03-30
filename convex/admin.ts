// convex/admin.ts
// Superadmin queries and mutations for organization management
// Requires SUPERADMIN_EMAILS env var set in Convex dashboard (comma-separated)
import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

function assertSuperadmin(callerEmail: string) {
  const allowed = (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.includes(callerEmail.toLowerCase())) {
    throw new Error("Forbidden: not a superadmin");
  }
}

// Plan prices for MRR calculation
const PLAN_PRICES: Record<string, number> = {
  solo: 79,
  practice: 149,
  "multi-location": 299,
};

// Plan included seats
const PLAN_SEATS: Record<string, number> = {
  solo: 1,
  practice: 2,
  "multi-location": 5,
};

// Plan encounter limits for usage checks
const PLAN_CONSULTATION_LIMITS: Record<string, number> = {
  solo: 150,
  practice: 500,
  "multi-location": 2000,
};

// Platform-wide metrics (superadmin only)
export const getPlatformMetrics = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const orgs = await ctx.db.query("organizations").collect();
    const encounters = await ctx.db.query("encounters").collect();
    const patients = await ctx.db.query("patients").collect();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartISO = monthStart.toISOString();

    // Total encounters this month
    const consultationsThisMonth = encounters.filter(
      (c) => c.createdAt >= monthStartISO
    ).length;

    // MRR: sum of plan prices for active orgs
    const mrr = orgs.reduce((sum, org) => {
      if (org.billingStatus === "active") {
        return sum + (PLAN_PRICES[org.plan] || 0);
      }
      return sum;
    }, 0);

    // Org signups this month
    const orgSignupsThisMonth = orgs.filter(
      (org) => org.createdAt >= monthStartISO
    ).length;

    // Daily encounter counts for last 30 days
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyMap = new Map<string, number>();
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      dailyMap.set(d.toISOString().split("T")[0], 0);
    }
    for (const c of encounters) {
      const day = c.createdAt.split("T")[0];
      if (dailyMap.has(day)) {
        dailyMap.set(day, dailyMap.get(day)! + 1);
      }
    }
    const consultationTrend = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Org signups by month (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlySignups = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlySignups.set(key, 0);
    }
    for (const org of orgs) {
      const d = new Date(org.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthlySignups.has(key)) {
        monthlySignups.set(key, monthlySignups.get(key)! + 1);
      }
    }
    const orgSignupsByMonth = Array.from(monthlySignups.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalOrgs: orgs.length,
      activeOrgs: orgs.filter((o) =>
        ["active", "trialing"].includes(o.billingStatus)
      ).length,
      totalConsultations: encounters.length,
      consultationsThisMonth,
      totalPatients: patients.length,
      mrr,
      orgSignupsThisMonth,
      consultationTrend,
      orgSignupsByMonth,
    };
  },
});

// Attention items — orgs needing action (superadmin only)
export const getAttentionItems = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const orgs = await ctx.db.query("organizations").collect();
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysISO = threeDaysFromNow.toISOString();
    const nowISO = now.toISOString();

    // Trials expiring within 3 days
    const expiringTrials = orgs
      .filter(
        (org) =>
          org.billingStatus === "trialing" &&
          org.trialEndsAt &&
          org.trialEndsAt <= threeDaysISO &&
          org.trialEndsAt > nowISO
      )
      .map((org) => ({
        _id: org._id,
        name: org.name,
        plan: org.plan,
        trialEndsAt: org.trialEndsAt!,
        daysRemaining: Math.max(
          0,
          Math.ceil(
            (new Date(org.trialEndsAt!).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        ),
      }));

    // Payment issues
    const paymentIssues = orgs
      .filter(
        (org) =>
          org.billingStatus === "past_due" || org.billingStatus === "unpaid"
      )
      .map((org) => ({
        _id: org._id,
        name: org.name,
        plan: org.plan,
        billingStatus: org.billingStatus,
      }));

    // Approaching encounter limits (>80% usage)
    const billingPeriodStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();

    const activeOrgs = orgs.filter(
      (org) =>
        org.billingStatus === "active" || org.billingStatus === "trialing"
    );

    const approachingLimits: Array<{
      _id: (typeof orgs)[0]["_id"];
      name: string;
      plan: string;
      usage: number;
      limit: number;
      percentUsed: number;
    }> = [];

    for (const org of activeOrgs) {
      const limit = PLAN_CONSULTATION_LIMITS[org.plan];
      if (!limit) continue;

      const records = await ctx.db
        .query("usageRecords")
        .withIndex("by_org_type_period", (q) =>
          q
            .eq("orgId", org._id)
            .eq("type", "encounter")
            .eq("billingPeriodStart", billingPeriodStart)
        )
        .collect();

      const usage = records.length;
      const percentUsed = Math.round((usage / limit) * 100);

      if (percentUsed >= 80) {
        approachingLimits.push({
          _id: org._id,
          name: org.name,
          plan: org.plan,
          usage,
          limit,
          percentUsed,
        });
      }
    }

    return { expiringTrials, paymentIssues, approachingLimits };
  },
});

// List all users (from memberships and providers tables, enriched with Clerk data)
export const listAllUsers = action({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<
    Array<{
      userId: string;
      name: string;
      email: string;
      orgCount: number;
      source: "vet_record" | "clerk" | "unknown";
    }>
  > => {
    assertSuperadmin(args.callerEmail);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;

    // Get all memberships to find unique users
    const memberships = await ctx.runQuery(
      api.memberships.getAllForAdmin,
      {}
    );
    const userIds = [...new Set(memberships.map((m: any) => m.userId))] as string[];

    // Get user details from providers table
    const providers = await ctx.runQuery(api.providers.getAllForAdmin, {});
    const vetsByUserId = new Map(providers.map((v: any) => [v.userId, v]));

    // Build user list with org counts, fetching from Clerk if needed
    const users = await Promise.all(
      userIds.map(async (userId: string) => {
        const userMemberships = memberships.filter((m: any) => m.userId === userId);
        const provider = vetsByUserId.get(userId) as any;

        // Always try Clerk first — provider record may have stale placeholder data
        if (clerkSecretKey) {
          try {
            const response = await fetch(
              `https://api.clerk.com/v1/users/${userId}`,
              {
                headers: {
                  Authorization: `Bearer ${clerkSecretKey}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (response.ok) {
              const clerkUser = (await response.json()) as {
                first_name?: string;
                last_name?: string;
                email_addresses?: Array<{
                  email_address: string;
                  id: string;
                }>;
                primary_email_address_id?: string;
              };

              const primaryEmail =
                clerkUser.email_addresses?.find(
                  (e) => e.id === clerkUser.primary_email_address_id
                )?.email_address ||
                clerkUser.email_addresses?.[0]?.email_address ||
                "No email";

              const name = [clerkUser.first_name, clerkUser.last_name]
                .filter(Boolean)
                .join(" ") || "No name set";

              return {
                userId,
                name,
                email: primaryEmail,
                orgCount: userMemberships.length,
                source: "clerk" as const,
              };
            }
          } catch (error) {
            console.error(`Failed to fetch Clerk user ${userId}:`, error);
          }
        }

        // Fall back to provider record if Clerk unavailable
        if (provider?.name && provider?.email) {
          return {
            userId,
            name: provider.name,
            email: provider.email,
            orgCount: userMemberships.length,
            source: "vet_record" as const,
          };
        }

        // Last resort
        return {
          userId,
          name: "Unknown User",
          email: "No email available",
          orgCount: userMemberships.length,
          source: "unknown" as const,
        };
      })
    );

    return users.sort((a, b) => b.orgCount - a.orgCount);
  },
});

// List all organizations (superadmin only)
export const listAllOrgs = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const orgs = await ctx.db.query("organizations").collect();

    // Enrich with member counts
    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const members = await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .filter((q) =>
            q.or(
              q.eq(q.field("status"), "active"),
              q.eq(q.field("status"), "pending")
            )
          )
          .collect();

        return {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          clerkOrgId: org.clerkOrgId,
          plan: org.plan,
          billingStatus: org.billingStatus,
          maxProviderSeats: org.maxProviderSeats,
          activeSeats: members.length,
          createdAt: org.createdAt,
        };
      })
    );

    return enriched;
  },
});

// Get a specific org by ID (superadmin only)
export const getOrgById = query({
  args: { id: v.id("organizations"), callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);
    return await ctx.db.get(args.id);
  },
});

// Grant full access to an organization (superadmin only)
export const grantAccess = mutation({
  args: { orgId: v.id("organizations"), callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    const seats = PLAN_SEATS[org.plan] ?? 1;

    await ctx.db.patch(args.orgId, {
      billingStatus: "active",
      maxProviderSeats: seats,
      updatedAt: new Date().toISOString(),
    });
  },
});

// List providers that have no orgId (orphans from pre-org era)
export const listOrphanVets = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const allVets = await ctx.db.query("providers").collect();
    const orphans = allVets.filter((v) => !v.orgId);

    const enriched = await Promise.all(
      orphans.map(async (provider) => {
        const patients = await ctx.db
          .query("patients")
          .filter((q) => q.eq(q.field("providerId"), provider.userId))
          .collect();

        const encounters = await ctx.db
          .query("encounters")
          .filter((q) => q.eq(q.field("providerId"), provider.userId))
          .collect();

        return {
          _id: provider._id,
          userId: provider.userId,
          name: provider.name,
          email: provider.email,
          createdAt: provider.createdAt,
          patientCount: patients.length,
          consultationCount: encounters.length,
        };
      })
    );

    return enriched;
  },
});

// Delete an orphan provider (superadmin only, must have no orgId)
export const deleteOrphanVet = mutation({
  args: {
    providerId: v.id("providers"),
    cascade: v.boolean(),
    callerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const provider = await ctx.db.get(args.providerId);
    if (!provider) throw new Error("Provider not found");
    if (provider.orgId) throw new Error("Provider belongs to an organization — cannot delete");

    if (args.cascade) {
      // Delete provider's patients
      const patients = await ctx.db
        .query("patients")
        .filter((q) => q.eq(q.field("providerId"), provider.userId))
        .collect();
      for (const patient of patients) {
        await ctx.db.delete(patient._id);
      }

      // Delete provider's encounters
      const encounters = await ctx.db
        .query("encounters")
        .filter((q) => q.eq(q.field("providerId"), provider.userId))
        .collect();
      for (const encounter of encounters) {
        await ctx.db.delete(encounter._id);
      }
    }

    await ctx.db.delete(args.providerId);
  },
});

// Internal query to get organization (for actions)
export const getOrgForAction = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orgId);
  },
});

// Internal mutation to delete organization from Convex database
export const deleteOrganizationFromDb = internalMutation({
  args: {
    orgId: v.id("organizations"),
    cascade: v.boolean(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    if (args.cascade) {
      // Delete all memberships
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      for (const membership of memberships) {
        await ctx.db.delete(membership._id);
      }

      // Delete all patients
      const patients = await ctx.db
        .query("patients")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      for (const patient of patients) {
        await ctx.db.delete(patient._id);
      }

      // Delete all encounters + their child recordings
      const encounters = await ctx.db
        .query("encounters")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      for (const encounter of encounters) {
        // Delete recordings belonging to this encounter
        const recordings = await ctx.db
          .query("recordings")
          .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
          .collect();
        for (const recording of recordings) {
          await ctx.db.delete(recording._id);
        }
        await ctx.db.delete(encounter._id);
      }

      // Delete all billing items
      const billingItems = await ctx.db
        .query("billingItems")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      for (const item of billingItems) {
        await ctx.db.delete(item._id);
      }

      // Delete all billing catalog entries
      const billingCatalog = await ctx.db
        .query("billingCatalog")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      for (const entry of billingCatalog) {
        await ctx.db.delete(entry._id);
      }

      // Delete all companion sessions
      const companionSessions = await ctx.db
        .query("companionSessions")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      for (const session of companionSessions) {
        await ctx.db.delete(session._id);
      }

      // Delete all follow-ups
      const followUps = await ctx.db
        .query("followUps")
        .filter((q) => q.eq(q.field("orgId"), args.orgId))
        .collect();
      for (const followUp of followUps) {
        await ctx.db.delete(followUp._id);
      }

      // Delete all usage records
      const usageRecords = await ctx.db
        .query("usageRecords")
        .filter((q) => q.eq(q.field("orgId"), args.orgId))
        .collect();
      for (const record of usageRecords) {
        await ctx.db.delete(record._id);
      }

      // Delete all locations
      const locations = await ctx.db
        .query("locations")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      for (const location of locations) {
        await ctx.db.delete(location._id);
      }
    }

    // Finally delete the organization
    await ctx.db.delete(args.orgId);
  },
});

// Public action to delete organization from both Clerk and Convex (superadmin only)
export const deleteOrganization = action({
  args: {
    orgId: v.id("organizations"),
    cascade: v.boolean(),
    callerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;

    // Get the organization to retrieve the clerkOrgId
    const org = await ctx.runQuery(api.admin.getOrgForAction, {
      orgId: args.orgId,
    });

    if (!org) {
      throw new Error("Organization not found");
    }

    // Attempt Clerk deletion — best-effort, never blocks Convex deletion.
    // Skipped if CLERK_SECRET_KEY isn't in Convex env vars or org has no clerkOrgId.
    if (clerkSecretKey && org.clerkOrgId) {
      try {
        const response = await fetch(
          `https://api.clerk.com/v1/organizations/${org.clerkOrgId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${clerkSecretKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          // Log but don't throw — Convex deletion should still proceed
          console.error("Clerk deletion failed (continuing with Convex deletion):", {
            status: response.status,
            error,
            clerkOrgId: org.clerkOrgId,
          });
        }
      } catch (error) {
        // Network or unexpected error — log and continue
        console.error("Clerk deletion threw (continuing with Convex deletion):", error);
      }
    } else {
      console.log(
        `Skipping Clerk deletion for ${org.name}: ` +
        (!clerkSecretKey ? "CLERK_SECRET_KEY not set in Convex env" : "no clerkOrgId on org")
      );
    }

    // Always delete from Convex
    await ctx.runMutation(internal.admin.deleteOrganizationFromDb, {
      orgId: args.orgId,
      cascade: args.cascade,
    });

    return { success: true };
  },
});

// Reset a user's account by deleting all their organizations (superadmin only)
// Designed for rapid testing of onboarding flows
export const resetUserAccount = action({
  args: {
    userId: v.string(),
    callerEmail: v.string(),
    skipClerk: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    orgsDeleted: number;
    organizations: Array<{ orgId: any; name: string; plan: string }>;
  }> => {
    assertSuperadmin(args.callerEmail);

    // Check if CLERK_SECRET_KEY is configured (unless skipClerk is true)
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!args.skipClerk && !clerkSecretKey) {
      throw new Error(
        "CLERK_SECRET_KEY is not configured in Convex environment variables. " +
        "Please add it in the Convex dashboard under Settings > Environment Variables."
      );
    }

    // Find all memberships for this user
    const memberships = await ctx.runQuery(api.memberships.getByUser, {
      userId: args.userId,
    });

    if (memberships.length === 0) {
      return {
        success: true,
        message: "No organizations found for this user",
        orgsDeleted: 0,
        organizations: [],
      };
    }

    // Get unique org IDs
    const orgIds = [...new Set(memberships.map((m: any) => m.orgId))];

    const deletedOrgs: Array<{ orgId: string; name: string; plan: string }> = [];

    // Delete each organization
    for (const orgId of orgIds) {
      try {
        const org = await ctx.runQuery(api.admin.getOrgForAction, { orgId });

        if (!org) {
          console.warn(`Organization ${orgId} not found, skipping`);
          continue;
        }

        // Delete from Clerk (unless skipClerk is true)
        if (!args.skipClerk && clerkSecretKey) {
          try {
            const response = await fetch(
              `https://api.clerk.com/v1/organizations/${org.clerkOrgId}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${clerkSecretKey}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (!response.ok) {
              console.error("Clerk deletion failed:", {
                status: response.status,
                orgName: org.name,
                clerkOrgId: org.clerkOrgId,
              });
              // Continue anyway - we'll delete from Convex
            }
          } catch (error) {
            console.error("Failed to delete from Clerk:", error);
            // Continue anyway - we'll delete from Convex
          }
        }

        // Delete from Convex database
        await ctx.runMutation(internal.admin.deleteOrganizationFromDb, {
          orgId,
          cascade: true,
        });

        deletedOrgs.push({
          orgId,
          name: org.name,
          plan: org.plan,
        });
      } catch (error) {
        console.error(`Failed to delete organization ${orgId}:`, error);
        throw error;
      }
    }

    return {
      success: true,
      message: `Reset complete! Deleted ${deletedOrgs.length} organization(s).`,
      orgsDeleted: deletedOrgs.length,
      organizations: deletedOrgs,
    };
  },
});

// Update organization plan (superadmin only)
// Bypasses Stripe - directly updates Convex database
// Also triggers upgrade wizard if upgrading to multi-location
export const updateOrgPlan = mutation({
  args: {
    orgId: v.id("organizations"),
    plan: v.string(),
    callerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    // Validate plan tier
    const validPlans = ["solo", "practice", "multi-location"];
    if (!validPlans.includes(args.plan)) {
      throw new Error(`Invalid plan: ${args.plan}`);
    }

    const planTier = args.plan as "solo" | "practice" | "multi-location";
    const maxProviderSeats = PLAN_SEATS[planTier];
    const fromPlan = org.plan;
    const timestamp = new Date().toISOString();

    // Update the plan
    await ctx.db.patch(args.orgId, {
      plan: planTier,
      maxProviderSeats,
      billingStatus: "active",
      updatedAt: timestamp,
    });

    // If this is an upgrade to multi-location, trigger the upgrade wizard
    const isUpgradingToMultiLocation =
      planTier === "multi-location" &&
      fromPlan !== "multi-location";

    if (isUpgradingToMultiLocation) {
      // Mark the plan upgrade to trigger wizard
      await ctx.db.patch(args.orgId, {
        lastPlanChange: {
          fromPlan,
          toPlan: planTier,
          changedAt: timestamp,
          wizardCompleted: false,
        },
      });

      // Get or create setup state
      const setup = await ctx.db
        .query("organizationSetup")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .first();

      if (setup) {
        // Mark location setup as incomplete to trigger wizard
        await ctx.db.patch(setup._id, {
          locationSetupCompleted: false,
          updatedAt: timestamp,
        });
      } else {
        // Create setup state
        await ctx.db.insert("organizationSetup", {
          orgId: args.orgId,
          onboardingCompleted: true,
          locationSetupCompleted: false, // Trigger wizard
          teamSetupCompleted: false,
          billingSetupCompleted: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    return {
      success: true,
      plan: planTier,
      maxProviderSeats,
      triggersWizard: isUpgradingToMultiLocation,
    };
  },
});

// DEBUG: List all memberships with org validation
export const debugListMemberships = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const memberships = await ctx.db.query("memberships").collect();

    const enriched = await Promise.all(
      memberships.map(async (m: any) => {
        const org = await ctx.db.get(m.orgId) as any;
        return {
          _id: m._id,
          userId: m.userId,
          orgId: m.orgId,
          orgExists: !!org,
          orgName: org?.name || "MISSING",
          orgClerkId: org?.clerkOrgId || "MISSING",
          role: m.role,
          status: m.status,
          createdAt: m.createdAt,
        };
      })
    );

    return enriched;
  },
});

// DEBUG: Delete orphaned memberships (ones with non-existent orgId)
export const debugDeleteOrphanedMemberships = mutation({
  args: { callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const memberships = await ctx.db.query("memberships").collect();
    const orphaned: Array<{ _id: Id<"memberships">; userId: string; orgId: Id<"organizations"> }> = [];

    for (const membership of memberships) {
      const org = await ctx.db.get(membership.orgId);
      if (!org) {
        orphaned.push({
          _id: membership._id,
          userId: membership.userId,
          orgId: membership.orgId,
        });
        await ctx.db.delete(membership._id);
      }
    }

    return { deleted: orphaned.length, orphanedMemberships: orphaned };
  },
});

// Detect orphaned Clerk organizations (ones that exist in Clerk but not in Convex)
export const detectOrphanedClerkOrgs = action({
  args: { callerEmail: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{
    totalClerkOrgs: number;
    totalConvexOrgs: number;
    orphanedCount: number;
    orphanedOrgs: Array<{
      clerkOrgId: string;
      name: string;
      createdAt: string;
    }>;
  }> => {
    assertSuperadmin(args.callerEmail);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    // Fetch all Clerk organizations
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
      throw new Error(`Failed to fetch Clerk orgs: ${clerkResponse.status}`);
    }

    const clerkData = (await clerkResponse.json()) as {
      data: Array<{ id: string; name: string; created_at: number }>;
    };

    // Fetch all Convex organizations
    const convexOrgs = await ctx.runQuery(api.organizations.getAllForAdmin, {});

    // Build set of Clerk org IDs that exist in Convex
    const convexClerkIds = new Set(convexOrgs.map((o: any) => o.clerkOrgId));

    // Find orphaned Clerk orgs
    const orphanedClerkOrgs = clerkData.data.filter(
      (clerkOrg) => !convexClerkIds.has(clerkOrg.id)
    );

    return {
      totalClerkOrgs: clerkData.data.length,
      totalConvexOrgs: convexOrgs.length,
      orphanedCount: orphanedClerkOrgs.length,
      orphanedOrgs: orphanedClerkOrgs.map((org) => ({
        clerkOrgId: org.id,
        name: org.name,
        createdAt: new Date(org.created_at).toISOString(),
      })),
    };
  },
});

// Repair an orphaned Clerk organization by creating the missing Convex org
export const repairOrphanedClerkOrg = action({
  args: {
    clerkOrgId: v.string(),
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
    overridePlan: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | {
        dryRun: true;
        preview: {
          clerkOrgId: string;
          name: string;
          slug: string;
          plan: string;
          maxProviderSeats: number;
          billingStatus: string;
          membersCount: number;
          actions: string[];
        };
      }
    | {
        success: true;
        orgId: any;
        clerkOrgId: string;
        name: string;
        plan: string;
      }
  > => {
    assertSuperadmin(args.callerEmail);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    // Fetch Clerk org details
    const clerkResponse = await fetch(
      `https://api.clerk.com/v1/organizations/${args.clerkOrgId}`,
      {
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!clerkResponse.ok) {
      throw new Error(`Failed to fetch Clerk org: ${clerkResponse.status}`);
    }

    const clerkOrg = (await clerkResponse.json()) as {
      id: string;
      name: string;
      slug: string;
      public_metadata?: { plan?: string };
      private_metadata?: { plan?: string };
      created_at: number;
      members_count?: number;
    };

    // Determine plan (from metadata, override, or default to 'solo')
    const metadataPlan =
      clerkOrg.public_metadata?.plan || clerkOrg.private_metadata?.plan;
    const plan =
      args.overridePlan || metadataPlan || "solo";

    // Validate plan
    const validPlans = ["solo", "practice", "multi-location"];
    if (!validPlans.includes(plan)) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    const planTier = plan as "solo" | "practice" | "multi-location";

    if (args.dryRun) {
      // Preview mode - show what would be created
      return {
        dryRun: true,
        preview: {
          clerkOrgId: clerkOrg.id,
          name: clerkOrg.name,
          slug: clerkOrg.slug,
          plan: planTier,
          maxProviderSeats: PLAN_SEATS[planTier],
          billingStatus: "trialing",
          membersCount: clerkOrg.members_count || 0,
          actions: [
            "Create Convex organization",
            "Create default location",
            "Create owner membership",
          ],
        },
      };
    }

    // Actually create the organization in Convex
    const timestamp = new Date().toISOString();

    const orgId = await ctx.runMutation(internal.admin.createOrganizationFromClerk, {
      clerkOrgId: clerkOrg.id,
      name: clerkOrg.name,
      slug: clerkOrg.slug,
      plan: planTier,
      timestamp,
    });

    return {
      success: true,
      orgId,
      clerkOrgId: clerkOrg.id,
      name: clerkOrg.name,
      plan: planTier,
    };
  },
});

// Internal mutation to create organization from Clerk data
export const createOrganizationFromClerk = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    plan: v.string(),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    const planTier = args.plan as "solo" | "practice" | "multi-location";

    // Create organization
    const orgId = await ctx.db.insert("organizations", {
      clerkOrgId: args.clerkOrgId,
      name: args.name,
      slug: args.slug,
      plan: planTier,
      maxProviderSeats: PLAN_SEATS[planTier],
      billingStatus: "trialing",
      trialEndsAt: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000
      ).toISOString(), // 14 days
      createdAt: args.timestamp,
      updatedAt: args.timestamp,
    });

    // Create default location
    await ctx.db.insert("locations", {
      orgId,
      name: args.name,
      isDefault: true,
      createdAt: args.timestamp,
      updatedAt: args.timestamp,
    });

    // Fetch Clerk org members to create memberships
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (clerkSecretKey) {
      try {
        const membersResponse = await fetch(
          `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/memberships?limit=100`,
          {
            headers: {
              Authorization: `Bearer ${clerkSecretKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (membersResponse.ok) {
          const membersData = (await membersResponse.json()) as {
            data: Array<{
              public_user_data: { user_id: string };
              role: string;
            }>;
          };

          // Create membership for owner (first admin)
          const ownerMember = membersData.data.find((m) => m.role === "org:admin");
          if (ownerMember) {
            await ctx.db.insert("memberships", {
              orgId,
              userId: ownerMember.public_user_data.user_id,
              role: "owner",
              status: "active",
              createdAt: args.timestamp,
              updatedAt: args.timestamp,
            });
          }
        }
      } catch (err) {
        console.error("Failed to create memberships:", err);
        // Continue anyway - org is created
      }
    }

    return orgId;
  },
});

// DANGER: Wipe all data from Convex database (DEVELOPMENT ONLY)
export const wipeAllData = mutation({
  args: { callerEmail: v.string(), confirm: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    // Safety check - must pass "WIPE_ALL_DATA" as confirmation
    if (args.confirm !== "WIPE_ALL_DATA") {
      throw new Error("Invalid confirmation - must pass 'WIPE_ALL_DATA' to proceed");
    }

    const summary: Record<string, number> = {};

    // Delete in order (dependent data first)

    // 1. Evidence files
    const evidenceFiles = await ctx.db.query("evidenceFiles").collect();
    for (const item of evidenceFiles) {
      await ctx.db.delete(item._id);
    }
    summary.evidenceFiles = evidenceFiles.length;

    // 2. Recordings
    const recordings = await ctx.db.query("recordings").collect();
    for (const item of recordings) {
      await ctx.db.delete(item._id);
    }
    summary.recordings = recordings.length;

    // 3. Follow-ups
    const followUps = await ctx.db.query("followUps").collect();
    for (const item of followUps) {
      await ctx.db.delete(item._id);
    }
    summary.followUps = followUps.length;

    // 4. Companion sessions
    const companionSessions = await ctx.db.query("companionSessions").collect();
    for (const item of companionSessions) {
      await ctx.db.delete(item._id);
    }
    summary.companionSessions = companionSessions.length;

    // 5. Encounters
    const encounters = await ctx.db.query("encounters").collect();
    for (const item of encounters) {
      await ctx.db.delete(item._id);
    }
    summary.encounters = encounters.length;

    // 6. Patients
    const patients = await ctx.db.query("patients").collect();
    for (const item of patients) {
      await ctx.db.delete(item._id);
    }
    summary.patients = patients.length;

    // 7. Usage records
    const usageRecords = await ctx.db.query("usageRecords").collect();
    for (const item of usageRecords) {
      await ctx.db.delete(item._id);
    }
    summary.usageRecords = usageRecords.length;

    // 8. Locations
    const locations = await ctx.db.query("locations").collect();
    for (const item of locations) {
      await ctx.db.delete(item._id);
    }
    summary.locations = locations.length;

    // 9. Memberships
    const memberships = await ctx.db.query("memberships").collect();
    for (const item of memberships) {
      await ctx.db.delete(item._id);
    }
    summary.memberships = memberships.length;

    // 10. Providers
    const providers = await ctx.db.query("providers").collect();
    for (const item of providers) {
      await ctx.db.delete(item._id);
    }
    summary.providers = providers.length;

    // 11. Organizations
    const organizations = await ctx.db.query("organizations").collect();
    for (const item of organizations) {
      await ctx.db.delete(item._id);
    }
    summary.organizations = organizations.length;

    // 12. Webhook events
    const webhookEvents = await ctx.db.query("processedWebhookEvents").collect();
    for (const item of webhookEvents) {
      await ctx.db.delete(item._id);
    }
    summary.processedWebhookEvents = webhookEvents.length;

    // 13. Organization setup tracking
    const orgSetup = await ctx.db.query("organizationSetup").collect();
    for (const item of orgSetup) {
      await ctx.db.delete(item._id);
    }
    summary.organizationSetup = orgSetup.length;

    return {
      success: true,
      message: "All data wiped from Convex database",
      deletedCounts: summary,
      totalDeleted: Object.values(summary).reduce((a, b) => a + b, 0),
    };
  },
});

// Migration: Fix stuck 'incomplete' accounts - give them 14-day trial
export const fixIncompleteAccounts = mutation({
  args: { callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const incompleteOrgs = await ctx.db
      .query("organizations")
      .withIndex("by_billing_status", (q) => q.eq("billingStatus", "incomplete"))
      .collect();

    const fixes: Array<{ orgId: Id<"organizations">; name: string; plan: string; slug: string }> = [];
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    for (const org of incompleteOrgs) {
      await ctx.db.patch(org._id, {
        billingStatus: "trialing",
        trialEndsAt,
        updatedAt: new Date().toISOString(),
      });

      fixes.push({
        orgId: org._id,
        name: org.name,
        plan: org.plan,
        slug: org.slug,
      });
    }

    return {
      success: true,
      fixed: fixes.length,
      organizations: fixes,
    };
  },
});

// Migration: Backfill missing provider records for existing users
export const backfillMissingVetRecords = action({
  args: { callerEmail: v.string(), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{
    success: boolean;
    dryRun: boolean;
    totalMemberships: number;
    missingVets: number;
    created: number;
    failed: Array<{ userId: string; error: string }>;
  }> => {
    assertSuperadmin(args.callerEmail);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    // Get all memberships
    const memberships = await ctx.runQuery(api.memberships.getAllForAdmin, {});
    const uniqueUserIds = [...new Set(memberships.map((m: any) => m.userId))] as string[];

    // Get all existing providers
    const providers = await ctx.runQuery(api.providers.getAllForAdmin, {});
    const vetUserIds = new Set(providers.map((v: any) => v.userId));

    // Find users with memberships but no provider records
    const missingVetUserIds = uniqueUserIds.filter(
      (userId: string) => !vetUserIds.has(userId)
    );

    console.log(`[Backfill] Found ${missingVetUserIds.length} users missing provider records`);

    if (args.dryRun) {
      return {
        success: true,
        dryRun: true,
        totalMemberships: memberships.length,
        missingVets: missingVetUserIds.length,
        created: 0,
        failed: [],
      };
    }

    const failed: Array<{ userId: string; error: string }> = [];
    let created = 0;

    for (const userId of missingVetUserIds) {
      try {
        // Get user's org from their first membership
        const userMembership = memberships.find((m: any) => m.userId === userId);
        if (!userMembership) continue;

        // Fetch user details from Clerk
        const userResponse = await fetch(
          `https://api.clerk.com/v1/users/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${clerkSecretKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!userResponse.ok) {
          failed.push({
            userId,
            error: `Clerk API error: ${userResponse.status}`,
          });
          continue;
        }

        const userData = (await userResponse.json()) as {
          first_name?: string;
          last_name?: string;
          email_addresses?: Array<{
            email_address: string;
            id: string;
          }>;
          primary_email_address_id?: string;
        };

        const name =
          [userData.first_name, userData.last_name].filter(Boolean).join(" ") ||
          "Provider User";

        const email =
          userData.email_addresses?.find(
            (e) => e.id === userData.primary_email_address_id
          )?.email_address ||
          userData.email_addresses?.[0]?.email_address ||
          "provider@example.com";

        // Create provider record
        await ctx.runMutation(api.providers.createOrUpdateProvider, {
          userId,
          name,
          email,
          orgId: userMembership.orgId,
        });

        created++;

        console.log(`[Backfill] Created provider record for ${userId}: ${name} (${email})`);
      } catch (error) {
        failed.push({
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: true,
      dryRun: false,
      totalMemberships: memberships.length,
      missingVets: missingVetUserIds.length,
      created,
      failed,
    };
  },
});

// ---------------------------------------------------------------------------
// Superadmin drill-down queries
// ---------------------------------------------------------------------------

/**
 * Get all members of a specific org, enriched with provider record data.
 * Used by the superadmin org detail panel.
 */
export const getOrgMembers = query({
  args: { orgId: v.id("organizations"), callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const provider = await ctx.db
          .query("providers")
          .filter((q) => q.eq(q.field("userId"), m.userId))
          .first();
        return {
          membershipId: m._id,
          userId: m.userId,
          role: m.role as string,
          name: provider?.name ?? "Unknown",
          email: provider?.email ?? "",
          joinedAt: m.createdAt as string,
        };
      })
    );

    // Owners first, then alphabetical
    return members.sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      return a.name.localeCompare(b.name);
    });
  },
});

/**
 * Get all orgs a user belongs to, with their role and encounter count.
 * Used by the superadmin user detail panel.
 */
export const getUserOrgs = query({
  args: { userId: v.string(), callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const results = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.orgId);
        if (!org) return null;

        const allConsultations = await ctx.db
          .query("encounters")
          .withIndex("by_org", (q) => q.eq("orgId", m.orgId))
          .collect();
        const userConsultations = allConsultations.filter(
          (c) => c.providerId === args.userId
        );

        return {
          orgId: org._id,
          orgName: org.name,
          plan: org.plan as string,
          billingStatus: org.billingStatus as string,
          role: m.role as string,
          consultationCount: userConsultations.length,
        };
      })
    );

    return results.filter(Boolean) as Array<{
      orgId: Id<"organizations">;
      orgName: string;
      plan: string;
      billingStatus: string;
      role: string;
      consultationCount: number;
    }>;
  },
});
