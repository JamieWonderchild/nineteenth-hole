import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seed billing catalog with sample human-medicine clinical items
 * Usage: npx convex run seedBillingCatalog:populateSampleItems '{"orgId":"..."}'
 */
export const populateSampleItems = mutation({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const orgId = args.orgId;

    const sampleItems = [
      // ─── Evaluation & Management (E&M) ───────────────────────────────────
      {
        name: "Office/Outpatient Visit – Established, Low Complexity (99213)",
        code: "99213",
        category: "em",
        basePrice: 12000, // $120.00
        taxable: false,
        description: "E&M — established patient, low medical decision making or 20 min total time",
      },
      {
        name: "Office/Outpatient Visit – Established, Moderate Complexity (99214)",
        code: "99214",
        category: "em",
        basePrice: 19000, // $190.00
        taxable: false,
        description: "E&M — established patient, moderate medical decision making or 30 min total time",
      },
      {
        name: "Office/Outpatient Visit – Established, High Complexity (99215)",
        code: "99215",
        category: "em",
        basePrice: 28000, // $280.00
        taxable: false,
        description: "E&M — established patient, high medical decision making or 40 min total time",
      },
      {
        name: "Office/Outpatient Visit – New Patient, Moderate Complexity (99204)",
        code: "99204",
        category: "em",
        basePrice: 22000, // $220.00
        taxable: false,
        description: "E&M — new patient, moderate medical decision making or 45 min total time",
      },
      {
        name: "Office/Outpatient Visit – New Patient, High Complexity (99205)",
        code: "99205",
        category: "em",
        basePrice: 31000, // $310.00
        taxable: false,
        description: "E&M — new patient, high medical decision making or 60 min total time",
      },
      {
        name: "Initial Hospital Care, Moderate Complexity (99222)",
        code: "99222",
        category: "em",
        basePrice: 35000, // $350.00
        taxable: false,
        description: "Inpatient admission E&M — moderate complexity",
      },
      {
        name: "Subsequent Hospital Care, Moderate Complexity (99232)",
        code: "99232",
        category: "em",
        basePrice: 18000, // $180.00
        taxable: false,
        description: "Inpatient daily E&M — moderate complexity",
      },
      {
        name: "Hospital Discharge Day Management ≤30 min (99238)",
        code: "99238",
        category: "em",
        basePrice: 17000, // $170.00
        taxable: false,
        description: "Hospital discharge E&M, 30 minutes or less",
      },
      {
        name: "ED E&M, Moderate Severity (99284)",
        code: "99284",
        category: "em",
        basePrice: 22000, // $220.00
        taxable: false,
        description: "Emergency department E&M — moderate severity",
      },
      {
        name: "ED E&M, High Severity (99285)",
        code: "99285",
        category: "em",
        basePrice: 33000, // $330.00
        taxable: false,
        description: "Emergency department E&M — high severity",
      },

      // ─── Critical Care ────────────────────────────────────────────────────
      {
        name: "Critical Care, First 30-74 min (99291)",
        code: "99291",
        category: "critical-care",
        basePrice: 55000, // $550.00
        taxable: false,
        description: "Critical care service, first 30–74 minutes",
      },
      {
        name: "Critical Care, Each Additional 30 min (99292)",
        code: "99292",
        category: "critical-care",
        basePrice: 27500, // $275.00
        taxable: false,
        description: "Critical care service, each additional 30-minute increment",
      },

      // ─── Observation ─────────────────────────────────────────────────────
      {
        name: "Observation Care, Initial – High Complexity (99220)",
        code: "99220",
        category: "observation",
        basePrice: 30000, // $300.00
        taxable: false,
        description: "Initial observation care, high medical decision making",
      },
      {
        name: "Observation Care, Subsequent (99224)",
        code: "99224",
        category: "observation",
        basePrice: 12000, // $120.00
        taxable: false,
        description: "Subsequent observation care per day, low complexity",
      },
      {
        name: "Observation Discharge Day Management (99217)",
        code: "99217",
        category: "observation",
        basePrice: 14000, // $140.00
        taxable: false,
        description: "Observation care discharge day management",
      },

      // ─── Procedures ──────────────────────────────────────────────────────
      {
        name: "Electrocardiogram (ECG/EKG) with Interpretation (93000)",
        code: "93000",
        category: "procedure",
        basePrice: 8500, // $85.00
        taxable: false,
        description: "12-lead ECG with interpretation and report",
      },
      {
        name: "Laceration Repair, Simple ≤2.5cm (12001)",
        code: "12001",
        category: "procedure",
        basePrice: 22000, // $220.00
        taxable: false,
        description: "Simple wound repair, scalp/neck/axilla/external genitalia/trunk, ≤2.5 cm",
      },
      {
        name: "IV Catheter Insertion (36000)",
        code: "36000",
        category: "procedure",
        basePrice: 7500, // $75.00
        taxable: false,
        description: "Introduction of needle or intracatheter, vein",
      },
      {
        name: "IV Infusion, Hydration (96360)",
        code: "96360",
        category: "procedure",
        basePrice: 9500, // $95.00
        taxable: false,
        description: "IV infusion, hydration, initial 31 minutes to 1 hour",
      },
      {
        name: "IM Injection, Single Drug (96372)",
        code: "96372",
        category: "procedure",
        basePrice: 4500, // $45.00
        taxable: false,
        description: "Therapeutic/prophylactic/diagnostic injection, IM",
      },
      {
        name: "Lumbar Puncture (62270)",
        code: "62270",
        category: "procedure",
        basePrice: 45000, // $450.00
        taxable: false,
        description: "Spinal puncture, lumbar, diagnostic",
      },
      {
        name: "Cardioversion, Elective (92960)",
        code: "92960",
        category: "procedure",
        basePrice: 65000, // $650.00
        taxable: false,
        description: "Cardioversion, elective, electrical conversion of arrhythmia; external",
      },

      // ─── Lab / Diagnostics ────────────────────────────────────────────────
      {
        name: "Complete Blood Count (CBC) with Differential (85025)",
        code: "85025",
        category: "lab",
        basePrice: 5500, // $55.00
        taxable: false,
        description: "CBC with automated differential WBC count",
      },
      {
        name: "Comprehensive Metabolic Panel (80053)",
        code: "80053",
        category: "lab",
        basePrice: 7500, // $75.00
        taxable: false,
        description: "Comprehensive metabolic panel (14 analytes)",
      },
      {
        name: "Basic Metabolic Panel (80048)",
        code: "80048",
        category: "lab",
        basePrice: 5000, // $50.00
        taxable: false,
        description: "Basic metabolic panel (8 analytes)",
      },
      {
        name: "Troponin I, Quantitative (86199)",
        code: "86199",
        category: "lab",
        basePrice: 8500, // $85.00
        taxable: false,
        description: "Troponin I, quantitative — cardiac marker",
      },
      {
        name: "Lactate (83605)",
        code: "83605",
        category: "lab",
        basePrice: 6000, // $60.00
        taxable: false,
        description: "Lactic acid level",
      },
      {
        name: "Blood Culture (87040)",
        code: "87040",
        category: "lab",
        basePrice: 12000, // $120.00
        taxable: false,
        description: "Culture, blood — aerobic and anaerobic",
      },
      {
        name: "Urinalysis with Microscopy (81001)",
        code: "81001",
        category: "lab",
        basePrice: 3500, // $35.00
        taxable: false,
        description: "Urinalysis, automated, with microscopy",
      },
      {
        name: "Blood Gas, Arterial (82803)",
        code: "82803",
        category: "lab",
        basePrice: 9500, // $95.00
        taxable: false,
        description: "Gases, blood, any combination of pH, pCO2, pO2, CO2, HCO3",
      },
      {
        name: "D-dimer, Quantitative (85379)",
        code: "85379",
        category: "lab",
        basePrice: 6500, // $65.00
        taxable: false,
        description: "Fibrin degradation products, D-dimer, quantitative",
      },
      {
        name: "Prothrombin Time / INR (85610)",
        code: "85610",
        category: "lab",
        basePrice: 4000, // $40.00
        taxable: false,
        description: "Prothrombin time",
      },
      {
        name: "BNP or NT-proBNP (83880)",
        code: "83880",
        category: "lab",
        basePrice: 9000, // $90.00
        taxable: false,
        description: "Natriuretic peptide — cardiac function marker",
      },

      // ─── Imaging ─────────────────────────────────────────────────────────
      {
        name: "Chest X-Ray, 2 Views (71046)",
        code: "71046",
        category: "imaging",
        basePrice: 18000, // $180.00
        taxable: false,
        description: "Radiologic examination, chest, 2 views",
      },
      {
        name: "CT Head without Contrast (70450)",
        code: "70450",
        category: "imaging",
        basePrice: 65000, // $650.00
        taxable: false,
        description: "CT scan, head/brain, without contrast",
      },
      {
        name: "CT Abdomen/Pelvis with Contrast (74177)",
        code: "74177",
        category: "imaging",
        basePrice: 120000, // $1,200.00
        taxable: false,
        description: "CT scan, abdomen and pelvis, with contrast",
      },
      {
        name: "Bedside Ultrasound, Limited (76942)",
        code: "76942",
        category: "imaging",
        basePrice: 25000, // $250.00
        taxable: false,
        description: "Ultrasonic guidance, imaging supervision and interpretation, limited",
      },
      {
        name: "ECG (Electrocardiogram), Tracing Only (93005)",
        code: "93005",
        category: "imaging",
        basePrice: 5000, // $50.00
        taxable: false,
        description: "Electrocardiogram, routine — tracing only",
      },

      // ─── Medications (common ED/inpatient) ───────────────────────────────
      {
        name: "Normal Saline 1L IV",
        code: "MED-NS-1L",
        category: "medication",
        basePrice: 4500, // $45.00
        taxable: false,
        description: "0.9% NaCl 1000 mL IV bag",
      },
      {
        name: "Morphine Sulfate 4mg IV",
        code: "MED-MORPH-4",
        category: "medication",
        basePrice: 3500, // $35.00
        taxable: false,
        description: "Morphine sulfate 4mg intravenous",
      },
      {
        name: "Ondansetron 4mg IV",
        code: "MED-ZOFRAN-4",
        category: "medication",
        basePrice: 2500, // $25.00
        taxable: false,
        description: "Ondansetron 4mg IV — antiemetic",
      },
      {
        name: "Ceftriaxone 1g IV",
        code: "MED-ROCEPH-1",
        category: "medication",
        basePrice: 8500, // $85.00
        taxable: false,
        description: "Ceftriaxone sodium 1g IV — broad-spectrum antibiotic",
      },
      {
        name: "Acetaminophen 1g IV",
        code: "MED-APAP-1G",
        category: "medication",
        basePrice: 4000, // $40.00
        taxable: false,
        description: "Acetaminophen 1000mg intravenous",
      },

      // ─── Hospitalization ─────────────────────────────────────────────────
      {
        name: "Medical/Surgical Inpatient Bed, per day",
        code: "HOSP-MEDSURG",
        category: "hospitalization",
        basePrice: 350000, // $3,500.00
        taxable: false,
        description: "Standard inpatient room and board, 24-hour care",
      },
      {
        name: "ICU / Step-Down Unit, per day",
        code: "HOSP-ICU",
        category: "hospitalization",
        basePrice: 850000, // $8,500.00
        taxable: false,
        description: "Intensive care unit bed, monitoring and nursing, per day",
      },
    ];

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
