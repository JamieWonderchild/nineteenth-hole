// Seed billing catalog with test data
// Usage: npx tsx scripts/seed-billing-catalog.ts <user-id> <org-id>

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://striped-raccoon-786.convex.cloud";

const catalogItems = [
  {
    code: "EXAM-001",
    name: "Comprehensive Physical Exam",
    category: "exam",
    basePrice: 7500, // $75.00 in cents
    taxable: true,
    description: "Basic comprehensive physical examination",
  },
  {
    code: "LAB-001",
    name: "CBC Panel",
    category: "lab",
    basePrice: 4500, // $45.00
    taxable: true,
    description: "Complete Blood Count panel",
  },
  {
    code: "LAB-002",
    name: "Urinalysis",
    category: "lab",
    basePrice: 3000, // $30.00
    taxable: true,
    description: "Urinalysis test",
  },
  {
    code: "PROC-001",
    name: "Dental Cleaning - Full",
    category: "procedure",
    basePrice: 18000, // $180.00
    taxable: true,
    description: "Full dental cleaning under sedation",
  },
  {
    code: "PROC-002",
    name: "Tooth Extraction",
    category: "procedure",
    basePrice: 6000, // $60.00
    taxable: true,
    description: "Single tooth extraction",
  },
  {
    code: "MED-001",
    name: "Amoxicillin 10-day supply",
    category: "medication",
    basePrice: 2500, // $25.00
    taxable: true,
    description: "Common antibiotic prescription",
  },
  {
    code: "MED-002",
    name: "Carprofen 500mg",
    category: "medication",
    basePrice: 4000, // $40.00
    taxable: true,
    description: "Pain management medication",
  },
  {
    code: "SUPPLY-001",
    name: "E-collar",
    category: "supply",
    basePrice: 1500, // $15.00
    taxable: true,
    description: "Elizabethan collar",
  },
  {
    code: "SUPPLY-002",
    name: "Bandage materials",
    category: "supply",
    basePrice: 1000, // $10.00
    taxable: true,
    description: "Consumable bandage materials",
  },
  {
    code: "PROC-003",
    name: "Emergency After-Hours",
    category: "procedure",
    basePrice: 10000, // $100.00
    taxable: false,
    description: "Emergency after-hours service fee",
  },
];

async function seedCatalog() {
  const userId = process.argv[2];
  const orgId = process.argv[3];

  if (!userId || !orgId) {
    console.error("❌ Usage: npx tsx scripts/seed-billing-catalog.ts <user-id> <org-id>");
    console.error("\nExample:");
    console.error("  npx tsx scripts/seed-billing-catalog.ts user_123 k178447mc2cdj9hykhz2cmz1p5836jc2");
    process.exit(1);
  }

  const client = new ConvexHttpClient(CONVEX_URL);

  console.log("🔄 Seeding billing catalog...");
  console.log("   Convex URL:", CONVEX_URL);
  console.log("   User ID:", userId);
  console.log("   Org ID:", orgId);
  console.log("");

  let created = 0;
  let skipped = 0;

  for (const item of catalogItems) {
    try {
      await client.mutation(api.billingCatalog.create, {
        userId,
        orgId,
        ...item,
      });
      console.log(`✅ Created: ${item.code} - ${item.name} ($${(item.basePrice / 100).toFixed(2)})`);
      created++;
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        console.log(`⏭️  Skipped: ${item.code} - ${item.name} (already exists)`);
        skipped++;
      } else {
        console.error(`❌ Failed: ${item.code} - ${error.message}`);
      }
    }
  }

  console.log("");
  console.log("✅ Catalog seeding complete!");
  console.log(`   Created: ${created} items`);
  console.log(`   Skipped: ${skipped} items`);
  console.log(`   Total: ${catalogItems.length} items`);
}

seedCatalog();
