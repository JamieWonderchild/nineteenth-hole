import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seed billing catalog with sample clinical items
 * Usage: npx convex run seedBillingCatalog:populateSampleItems '{"orgId":"k173gmjkthd6ah3sdb3ah5q3hn82yw4c"}'
 */
export const populateSampleItems = mutation({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const orgId = args.orgId;

    // Sample catalog items
    const sampleItems = [
      // Exams
      {
        name: "Comprehensive Physical Exam",
        code: "EXAM-001",
        category: "exam",
        basePrice: 7500, // $75.00
        taxable: true,
        description: "Complete nose-to-tail physical examination",
      },
      {
        name: "Wellness Exam",
        code: "EXAM-002",
        category: "exam",
        basePrice: 5500, // $55.00
        taxable: true,
        description: "Annual wellness checkup",
      },
      {
        name: "Senior Pet Exam",
        code: "EXAM-003",
        category: "exam",
        basePrice: 8500, // $85.00
        taxable: true,
        description: "Comprehensive exam for senior pets (7+ years)",
      },

      // Procedures
      {
        name: "Spay Surgery (Cat)",
        code: "SURG-001",
        category: "procedure",
        basePrice: 25000, // $250.00
        taxable: true,
        description: "Ovariohysterectomy for female cats",
      },
      {
        name: "Neuter Surgery (Dog)",
        code: "SURG-002",
        category: "procedure",
        basePrice: 30000, // $300.00
        taxable: true,
        description: "Castration for male dogs",
      },
      {
        name: "Dental Cleaning",
        code: "DENT-001",
        category: "procedure",
        basePrice: 35000, // $350.00
        taxable: true,
        description: "Professional dental prophylaxis under anesthesia",
      },
      {
        name: "Tooth Extraction",
        code: "DENT-002",
        category: "procedure",
        basePrice: 15000, // $150.00
        taxable: true,
        description: "Surgical extraction of diseased tooth",
      },

      // Lab Tests
      {
        name: "Complete Blood Count (CBC)",
        code: "LAB-001",
        category: "lab",
        basePrice: 6500, // $65.00
        taxable: true,
        description: "Full blood cell analysis",
      },
      {
        name: "Chemistry Panel",
        code: "LAB-002",
        category: "lab",
        basePrice: 8500, // $85.00
        taxable: true,
        description: "Comprehensive metabolic panel",
      },
      {
        name: "Urinalysis",
        code: "LAB-003",
        category: "lab",
        basePrice: 4500, // $45.00
        taxable: true,
        description: "Complete urinalysis with microscopy",
      },
      {
        name: "Fecal Examination",
        code: "LAB-004",
        category: "lab",
        basePrice: 3500, // $35.00
        taxable: true,
        description: "Fecal flotation and microscopy",
      },

      // Medications
      {
        name: "Heartgard Plus (6-month supply)",
        code: "MED-001",
        category: "medication",
        basePrice: 12000, // $120.00
        taxable: false,
        description: "Heartworm prevention medication",
      },
      {
        name: "Frontline Plus (3-month supply)",
        code: "MED-002",
        category: "medication",
        basePrice: 8500, // $85.00
        taxable: false,
        description: "Flea and tick prevention",
      },
      {
        name: "Amoxicillin 500mg (30 tablets)",
        code: "MED-003",
        category: "medication",
        basePrice: 4500, // $45.00
        taxable: false,
        description: "Antibiotic for bacterial infections",
      },
      {
        name: "Carprofen 100mg (30 tablets)",
        code: "MED-004",
        category: "medication",
        basePrice: 6500, // $65.00
        taxable: false,
        description: "Non-steroidal anti-inflammatory",
      },

      // Imaging
      {
        name: "Digital X-Ray (2 views)",
        code: "XRAY-001",
        category: "imaging",
        basePrice: 15000, // $150.00
        taxable: true,
        description: "Two-view radiographic study",
      },
      {
        name: "Digital X-Ray (4 views)",
        code: "XRAY-002",
        category: "imaging",
        basePrice: 25000, // $250.00
        taxable: true,
        description: "Four-view radiographic study",
      },
      {
        name: "Ultrasound Examination",
        code: "US-001",
        category: "imaging",
        basePrice: 35000, // $350.00
        taxable: true,
        description: "Abdominal ultrasound imaging",
      },

      // Supplies
      {
        name: "E-Collar (Medium)",
        code: "SUPP-001",
        category: "supply",
        basePrice: 2500, // $25.00
        taxable: true,
        description: "Elizabethan collar for wound protection",
      },
      {
        name: "Bandage Change",
        code: "SUPP-002",
        category: "supply",
        basePrice: 3500, // $35.00
        taxable: true,
        description: "Bandage replacement and wound assessment",
      },

      // Hospitalization
      {
        name: "Hospitalization (per day)",
        code: "HOSP-001",
        category: "hospitalization",
        basePrice: 8500, // $85.00
        taxable: true,
        description: "24-hour inpatient care and monitoring",
      },
      {
        name: "IV Fluid Therapy (per day)",
        code: "HOSP-002",
        category: "hospitalization",
        basePrice: 6500, // $65.00
        taxable: true,
        description: "Intravenous fluid administration",
      },
    ];

    // Create all items
    const createdItems = [];
    for (const item of sampleItems) {
      const id = await ctx.db.insert("billingCatalog", {
        orgId,
        ...item,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      createdItems.push({ id, name: item.name });
    }

    return {
      success: true,
      orgId,
      itemsCreated: createdItems.length,
      items: createdItems,
    };
  },
});
