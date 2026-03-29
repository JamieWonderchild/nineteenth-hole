// Script to wipe all Convex tables
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://charming-blackbird-181.convex.cloud");

async function main() {
  console.log("⚠️  This will DELETE ALL DATA from production Convex database!");
  console.log("Tables to be wiped:");
  console.log("  - organizations");
  console.log("  - memberships");
  console.log("  - providers");
  console.log("  - patients");
  console.log("  - encounters");
  console.log("  - recordings");
  console.log("  - companionSessions");
  console.log("  - followUps");
  console.log("  - evidenceFiles");
  console.log("  - locations");
  console.log("  - invitations");
  console.log("  - and more...");
  console.log("\nTo wipe the database, you need to:");
  console.log("1. Go to Convex dashboard: https://dashboard.convex.dev");
  console.log("2. Select your project (charming-blackbird-181)");
  console.log("3. Go to Data tab");
  console.log("4. Clear each table manually");
  console.log("\nOR use the Convex CLI:");
  console.log("  npx convex import --replace-all <empty-export.zip>");

  process.exit(0);
}

main();
