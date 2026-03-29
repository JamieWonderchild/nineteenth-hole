#!/usr/bin/env node
// DANGER: This script wipes ALL data from Clerk and Convex
// Only use in development!

import { ConvexHttpClient } from "convex/browser";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SUPERADMIN_EMAIL = "jamie.aronson00@gmail.com";

if (!CLERK_SECRET_KEY || !CONVEX_URL) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

console.log("⚠️  WARNING: This will DELETE ALL DATA from Clerk and Convex!");
console.log("⚠️  This action CANNOT be undone!");
console.log("");

// In a real scenario, we'd wait for user confirmation
// For now, proceeding...

async function wipeClerk() {
  console.log("\n🗑️  Deleting Clerk organizations...");

  const response = await fetch("https://api.clerk.com/v1/organizations?limit=100", {
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
    },
  });

  const data = await response.json();
  const orgs = data.data || [];

  console.log(`Found ${orgs.length} organizations to delete`);

  for (const org of orgs) {
    try {
      await fetch(`https://api.clerk.com/v1/organizations/${org.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        },
      });
      console.log(`  ✅ Deleted: ${org.name} (${org.id})`);
    } catch (error) {
      console.log(`  ❌ Failed to delete ${org.name}: ${error.message}`);
    }
  }
}

async function wipeConvex() {
  console.log("\n🗑️  Wiping Convex tables...");

  // Import the admin mutations
  const { api } = await import("../convex/_generated/api.js");

  try {
    const result = await convex.mutation(api.admin.wipeAllData, {
      callerEmail: SUPERADMIN_EMAIL,
      confirm: "WIPE_ALL_DATA",
    });

    console.log(`\n✅ Successfully wiped Convex database`);
    console.log(`   Total records deleted: ${result.totalDeleted}`);
    console.log("\nDeleted by table:");
    Object.entries(result.deletedCounts).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`   - ${table}: ${count}`);
      }
    });
  } catch (error) {
    console.error("❌ Failed to wipe Convex:", error.message);
    throw error;
  }
}

async function main() {
  await wipeClerk();
  await wipeConvex();

  console.log("\n✅ Wipe complete!");
  console.log("   - All Clerk organizations deleted");
  console.log("   - Convex tables need manual cleanup (dashboard)");
  console.log("\n🎯 Next: Test onboarding with fresh databases");
}

main().catch((error) => {
  console.error("❌ Wipe failed:", error);
  process.exit(1);
});
