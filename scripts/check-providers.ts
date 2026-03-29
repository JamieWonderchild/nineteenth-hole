// Check for providers with missing orgId
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://charming-blackbird-181.convex.cloud");

async function main() {
  try {
    // Try to manually query all providers without index
    const response = await fetch("https://charming-blackbird-181.convex.cloud/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "debug:getAllVets",
        args: {},
        format: "json"
      })
    });

    const data = await response.json();
    console.log("ALL VETS (via debug query):");
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error fetching providers:", error);
  }

  process.exit(0);
}

main();
