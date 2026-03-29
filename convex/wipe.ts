// DANGER: This mutation wipes all data from the database
// Only use for development/testing purposes
import { internalMutation } from "./_generated/server";

export const wipeAllTables = internalMutation({
  handler: async (ctx) => {
    const tables = [
      "organizations",
      "memberships",
      "providers",
      "patients",
      "encounters",
      "recordings",
      "companionSessions",
      "followUps",
      "evidenceFiles",
      "locations",
      "invitations",
      "usageRecords",
      "processedWebhookEvents",
      "errorLogs",
      "organizationSetup",
      "userPreferences",
      "analyticsEvents",
      "caseReasoningSessions",
    ] as const;

    let totalDeleted = 0;

    for (const tableName of tables) {
      try {
        const docs = await ctx.db.query(tableName).collect();
        for (const doc of docs) {
          await ctx.db.delete(doc._id);
        }
        console.log(`✓ Cleared ${docs.length} documents from ${tableName}`);
        totalDeleted += docs.length;
      } catch (error) {
        console.error(`✗ Failed to clear ${tableName}:`, error);
      }
    }

    return {
      success: true,
      totalDeleted,
      message: `Wiped ${totalDeleted} total documents from ${tables.length} tables`,
    };
  },
});
