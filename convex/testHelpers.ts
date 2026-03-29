// Test helper functions for creating test data
import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create a test encounter for testing purposes
 * This is useful for automated testing and development
 */
export const createTestEncounter = mutation({
  args: {
    providerId: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    // Create a test patient first
    const patientId = await ctx.db.insert("patients", {
      name: "Test Patient Alex",
      age: "34 years",
      sex: "Male",
      providerId: args.providerId || "test_provider_001",
      orgId: args.orgId,
      isActive: true,
      medicalHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create test facts
    const testFacts = [
      {
        id: "fact_001",
        text: "Alex is a 34-year-old male presenting for follow-up",
        group: "demographics",
      },
      {
        id: "fact_002",
        text: "Chief complaint: Acute nausea and vomiting since yesterday evening",
        group: "chief-complaint",
      },
      {
        id: "fact_003",
        text: "Vomited 5 times in the last 24 hours, partially digested food",
        group: "history",
      },
      {
        id: "fact_004",
        text: "Decreased appetite, not eating breakfast this morning",
        group: "history",
      },
      {
        id: "fact_005",
        text: "No known toxin exposure, no recent medication changes",
        group: "history",
      },
      {
        id: "fact_006",
        text: "Temperature: 38.9°C (102°F), Heart Rate: 110 bpm, Respiratory Rate: 24/min, BP: 118/76",
        group: "vitals",
      },
      {
        id: "fact_007",
        text: "Physical exam: Mild epigastric tenderness on palpation, otherwise normal",
        group: "physical-exam",
      },
    ];

    // Create the encounter
    const encounterId = await ctx.db.insert("encounters", {
      patientId,
      providerId: args.providerId || "test_provider_001",
      orgId: args.orgId,
      status: "finalized",
      date: new Date().toISOString(),
      facts: testFacts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastGeneratedAt: new Date().toISOString(),
    });

    // Create a test recording
    await ctx.db.insert("recordings", {
      encounterId,
      interactionId: `test_interaction_${Date.now()}`,
      phase: "initial",
      duration: 180,
      facts: testFacts,
      transcript: "Test transcription: Alex presented with acute nausea and vomiting since yesterday evening...",
      createdAt: new Date().toISOString(),
    });

    return {
      encounterId,
      patientId,
      message: "Test encounter created successfully",
    };
  },
});
