// Temporary script to query production Convex database
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://charming-blackbird-181.convex.cloud");

async function main() {
  try {
    // Query all organizations (admin query)
    const orgs = await client.query("organizations:getAllForAdmin" as any);
    console.log("=== ORGANIZATIONS ===");
    console.log(JSON.stringify(orgs, null, 2));

    if (orgs && orgs.length > 0) {
      for (const org of orgs) {
        console.log(`\n=== ORGANIZATION: ${org.name} (${org._id}) ===`);

        // Query memberships for this org
        const memberships = await client.query("memberships:getByOrg" as any, { orgId: org._id });
        console.log("\nMEMBERSHIPS:");
        console.log(JSON.stringify(memberships, null, 2));

        // Query providers for this org
        const providers = await client.query("providers:getProvidersByOrg" as any, { orgId: org._id });
        console.log("\nVETS:");
        console.log(JSON.stringify(providers, null, 2));

        // Check for dad's provider record
        const dadUserId = "user_3B2F0zOdv0RvGwc91zgKAQVZ9vH";
        const dadVet = await client.query("providers:getProviderByUserId" as any, { userId: dadUserId });
        console.log(`\nDAD'S VET RECORD (${dadUserId}):`);
        console.log(JSON.stringify(dadVet, null, 2));

        // Query memberships with user info (this is the failing query)
        try {
          const membershipsWithInfo = await client.query("memberships:getByOrgWithUserInfo" as any, { orgId: org._id });
          console.log("\nMEMBERSHIPS WITH USER INFO:");
          console.log(JSON.stringify(membershipsWithInfo, null, 2));
        } catch (err) {
          console.error("\n❌ ERROR in getByOrgWithUserInfo:", err);
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

main();
