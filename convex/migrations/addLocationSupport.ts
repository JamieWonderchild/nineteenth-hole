// Migration: Add location support to existing organizations
// Creates default location for orgs without locations
// Run this once after deploying the multi-location schema changes

import { internalMutation } from "../_generated/server";

export default internalMutation({
  handler: async (ctx) => {
    console.log("[Migration] Starting addLocationSupport migration...");

    // Get all organizations
    const orgs = await ctx.db.query("organizations").collect();
    console.log(`[Migration] Found ${orgs.length} organizations`);

    let createdCount = 0;

    for (const org of orgs) {
      // Check if org already has locations
      const existingLocations = await ctx.db
        .query("locations")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();

      if (existingLocations.length > 0) {
        console.log(
          `[Migration] Org ${org.name} (${org._id}) already has ${existingLocations.length} locations, skipping...`
        );
        continue;
      }

      // Create default location
      const locationName = org.clinicName || org.name || "Main Location";
      const timestamp = new Date().toISOString();

      await ctx.db.insert("locations", {
        orgId: org._id,
        name: locationName,
        address: org.clinicAddress,
        phone: org.clinicPhone,
        isDefault: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // Set migration flags on organization
      await ctx.db.patch(org._id, {
        needsLocationReview: true,
        migratedAt: timestamp,
        updatedAt: timestamp,
      });

      createdCount++;
      console.log(
        `[Migration] Created default location "${locationName}" for org ${org.name} (${org._id})`
      );
    }

    console.log(
      `[Migration] addLocationSupport migration complete. Created ${createdCount} default locations.`
    );

    return {
      success: true,
      orgsProcessed: orgs.length,
      locationsCreated: createdCount,
    };
  },
});
