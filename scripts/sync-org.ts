// Quick script to manually create an organization in Convex dev
// Usage: npx tsx scripts/sync-org.ts

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://striped-raccoon-786.convex.cloud";
const CLERK_ORG_ID = "org_3B4sFgSSP0csd6H7V7jkHZWQ2w0";

async function syncOrg() {
  const client = new ConvexHttpClient(CONVEX_URL);

  // You need to provide your user ID here
  const USER_ID = process.argv[2];

  if (!USER_ID) {
    console.error("❌ Please provide your user ID:");
    console.error("   npx tsx scripts/sync-org.ts <your-clerk-user-id>");
    console.error("\nYou can find your user ID in the Clerk dashboard or browser console.");
    process.exit(1);
  }

  try {
    console.log("🔄 Setting up organization membership...");
    console.log("   Convex URL:", CONVEX_URL);
    console.log("   Clerk Org ID:", CLERK_ORG_ID);
    console.log("   User ID:", USER_ID);

    // Try to create org, if it fails (already exists), that's fine
    let orgId;
    try {
      orgId = await client.mutation(api.organizations.create, {
        clerkOrgId: CLERK_ORG_ID,
        name: "Dev Test Organization",
        slug: "dev-test-org",
        plan: "solo",
        maxProviderSeats: 1,
        billingStatus: "trialing",
      });
      console.log("✅ Organization created!");
    } catch (err: any) {
      if (err.message?.includes("slug already taken")) {
        console.log("ℹ️  Organization already exists");
        // Hardcode the org ID we created earlier
        orgId = "k178447mc2cdj9hykhz2cmz1p5836jc2";
      } else {
        throw err;
      }
    }

    // Create membership
    console.log("🔄 Creating membership...");
    await client.mutation(api.memberships.create, {
      userId: USER_ID,
      orgId: orgId,
      role: "admin",
      status: "active",
    });

    console.log("✅ Success! You're now a member of the organization.");
    console.log("   Organization ID:", orgId);
  } catch (error) {
    console.error("❌ Failed:");
    console.error(error);
    process.exit(1);
  }
}

syncOrg();
