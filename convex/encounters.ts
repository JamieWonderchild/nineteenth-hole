// convex/encounters.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Save a complete encounter from voice recording (facts + diagnosis)
// If encounterId is provided, appends a recording to the existing encounter.
// Otherwise creates a new encounter + recording (backward compatible).
export const saveVoiceConsultation = mutation({
  args: {
    patientId: v.id("patients"),
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")),
    locationId: v.optional(v.id("locations")),
    interactionId: v.string(),
    transcription: v.string(),
    facts: v.array(v.object({
      id: v.string(),
      text: v.string(),
      group: v.string(),
    })),
    physicalExam: v.optional(v.object({
      temperature: v.optional(v.number()),
      weight: v.optional(v.number()),
      weightUnit: v.optional(v.string()),
      heartRate: v.optional(v.number()),
      respiratoryRate: v.optional(v.number()),
      notes: v.optional(v.string()),
    })),
    diagnosisResult: v.optional(v.object({
      generatedAt: v.string(),
      triage: v.optional(v.object({
        urgencyLevel: v.string(),
        redFlags: v.array(v.string()),
        recommendedWorkflow: v.string(),
        reasoning: v.string(),
      })),
      patientContext: v.optional(v.object({
        ageCategory: v.string(),
        ageInYears: v.number(),
        weightKg: v.number(),
        riskFactors: v.optional(v.array(v.string())),
      })),
      differentials: v.optional(v.object({
        differentials: v.array(v.object({
          condition: v.string(),
          probability: v.string(),
          reasoning: v.string(),
          supportingEvidence: v.optional(v.array(v.string())),
          contradictingEvidence: v.optional(v.array(v.string())),
        })),
        keyFindings: v.array(v.string()),
      })),
      tests: v.optional(v.object({
        recommendedTests: v.array(v.object({
          test: v.string(),
          priority: v.string(),
          rationale: v.string(),
          targetConditions: v.optional(v.array(v.string())),
        })),
        suggestedPanel: v.optional(v.string()),
      })),
      treatments: v.optional(v.object({
        medications: v.array(v.object({
          drug: v.string(),
          drugClass: v.optional(v.string()),
          dose: v.string(),
          route: v.string(),
          frequency: v.string(),
          duration: v.string(),
          doseCalculation: v.optional(v.string()),
        })),
        supportiveCare: v.optional(v.array(v.string())),
        patientInstructions: v.optional(v.array(v.string())),
        warningSignsForPatient: v.optional(v.array(v.string())),
        followUpRecommendation: v.optional(v.object({
          timing: v.string(),
          purpose: v.string(),
        })),
      })),
      agentTrace: v.optional(v.array(v.object({
        agent: v.string(),
        status: v.string(),
        duration: v.number(),
      }))),
    })),
    encounterId: v.optional(v.id("encounters")),
    recordingPhase: v.optional(v.string()),
    recordingDuration: v.optional(v.number()),
    extractedPatientInfo: v.optional(v.object({
      name: v.optional(v.string()),
      age: v.optional(v.string()),
      weight: v.optional(v.string()),
      sex: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    // Verify provider exists
    const provider = await ctx.db
      .query("providers")
      .filter((q) => q.eq(q.field("userId"), args.providerId))
      .first();

    if (!provider || !provider.isActive) {
      throw new Error("Provider not found or inactive");
    }

    // Verify patient exists and belongs to provider
    const patient = await ctx.db.get(args.patientId);
    if (!patient || patient.providerId !== args.providerId) {
      throw new Error("Patient not found or doesn't belong to provider");
    }

    // Update patient's weight if provided
    if (args.physicalExam?.weight && args.physicalExam?.weightUnit) {
      await ctx.db.patch(args.patientId, {
        weight: args.physicalExam.weight.toString(),
        weightUnit: args.physicalExam.weightUnit,
        updatedAt: timestamp,
      });
    }

    // Build diagnosis and treatment strings from result
    let diagnosisString = '';
    let treatmentString = '';

    if (args.diagnosisResult) {
      if (args.diagnosisResult.differentials?.differentials) {
        diagnosisString = args.diagnosisResult.differentials.differentials
          .map((d, i) => `${i + 1}. ${d.condition} (${d.probability}): ${d.reasoning}`)
          .join('\n');
      }

      if (args.diagnosisResult.treatments?.medications) {
        treatmentString = args.diagnosisResult.treatments.medications
          .map(m => `${m.drug}: ${m.dose} ${m.route} ${m.frequency} for ${m.duration}`)
          .join('\n');
      }
    }

    let encounterId: Id<"encounters">;

    if (args.encounterId) {
      // Append recording to existing encounter
      const existing = await ctx.db.get(args.encounterId);
      if (!existing) throw new Error("Encounter not found");

      // Guard: cannot add recordings to published encounters
      if (existing.status === 'published') {
        throw new Error("Cannot add recordings to a published encounter. Only addenda can be added.");
      }

      encounterId = args.encounterId;

      // Merge facts: existing + new (dedup by text)
      const existingFacts = existing.facts || [];
      const existingTexts = new Set(existingFacts.map(f => f.text.toLowerCase().trim()));
      const newFacts = args.facts.filter(f => !existingTexts.has(f.text.toLowerCase().trim()));
      const mergedFacts = [...existingFacts, ...newFacts];

      // Concatenate transcription
      const mergedTranscript = existing.transcription
        ? `${existing.transcription}\n\n---\n\n${args.transcription}`
        : args.transcription;

      await ctx.db.patch(encounterId, {
        transcription: mergedTranscript,
        facts: mergedFacts,
        interactionId: args.interactionId, // Update to latest interactionId
        physicalExam: args.physicalExam || existing.physicalExam,
        diagnosis: diagnosisString || existing.diagnosis,
        treatment: treatmentString || existing.treatment,
        status: 'in-progress',
        updatedAt: timestamp,
        ...(args.diagnosisResult ? { diagnosisResult: args.diagnosisResult } : {}),
        ...(args.extractedPatientInfo ? { extractedPatientInfo: args.extractedPatientInfo } : {}),
      });
    } else {
      // Create new encounter
      encounterId = await ctx.db.insert("encounters", {
        patientId: args.patientId,
        providerId: args.providerId,
        orgId: args.orgId,
        locationId: args.locationId,
        date: timestamp.split('T')[0],
        transcription: args.transcription,
        physicalExam: args.physicalExam,
        diagnosis: diagnosisString || undefined,
        treatment: treatmentString || undefined,
        followUp: args.diagnosisResult?.triage?.reasoning,
        createdAt: timestamp,
        updatedAt: timestamp,
        interactionId: args.interactionId,
        facts: args.facts,
        diagnosisResult: args.diagnosisResult,
        status: 'in-progress',
        extractedPatientInfo: args.extractedPatientInfo,
      });

      // Add to patient's medical history
      await ctx.db.patch(args.patientId, {
        medicalHistory: [
          ...patient.medicalHistory,
          {
            date: timestamp.split('T')[0],
            type: 'encounter',
            notes: args.transcription.substring(0, 500),
            diagnosis: args.diagnosisResult?.differentials?.differentials?.[0]?.condition,
            treatment: args.diagnosisResult?.treatments?.medications?.[0]?.drug,
            medications: args.diagnosisResult?.treatments?.medications?.map(m => m.drug),
          }
        ],
        updatedAt: timestamp,
      });
    }

    // Always create a recording child row
    const existingRecordings = await ctx.db
      .query("recordings")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
      .collect();

    const willExtract = !!(args.orgId && args.facts.length > 0);

    const recordingId = await ctx.db.insert("recordings", {
      encounterId,
      interactionId: args.interactionId,
      transcript: args.transcription,
      facts: args.facts,
      phase: args.recordingPhase,
      duration: args.recordingDuration,
      orderIndex: existingRecordings.length,
      createdAt: timestamp,
      ...(willExtract ? { billingExtractionStatus: "processing" as const } : {}),
    });

    // BACKGROUND BILLING EXTRACTION
    // Schedule async job to extract billing items from this recording
    console.log(`[SaveVoiceConsultation] Recording saved: ${recordingId}`);
    console.log(`[SaveVoiceConsultation] orgId: ${args.orgId}, facts: ${args.facts.length}`);
    if (willExtract && args.orgId) {
      console.log(`[SaveVoiceConsultation] ✅ Scheduling billing extraction...`);
      await ctx.scheduler.runAfter(0, api.billingExtraction.extractFromRecording, {
        encounterId,
        recordingId,
        orgId: args.orgId,
        userId: args.providerId,
      });
      console.log(`[SaveVoiceConsultation] Billing extraction scheduled successfully`);
    } else {
      console.log(`[SaveVoiceConsultation] ⏭️  Skipping billing extraction (orgId: ${args.orgId}, facts: ${args.facts.length})`);
    }

    // Audit log: encounter create/update is a PHI event
    await ctx.runMutation(internal.auditLogs.log, {
      orgId: args.orgId,
      userId: args.providerId,
      action: args.encounterId ? 'update' : 'create',
      resourceType: 'encounter',
      resourceId: encounterId,
      metadata: JSON.stringify({ recordingId, factCount: args.facts.length }),
    });

    return { encounterId, recordingId }; // Return both IDs for tracking
  },
});

export const addConsultation = mutation({
  args: {
    patientId: v.id("patients"),
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")),
    date: v.string(),
    transcription: v.optional(v.string()),
    physicalExam: v.optional(v.object({
      temperature: v.optional(v.number()),
      weight: v.optional(v.number()),
      weightUnit: v.optional(v.string()),
      heartRate: v.optional(v.number()),
      respiratoryRate: v.optional(v.number()),
      notes: v.optional(v.string()),
    })),
    diagnosis: v.optional(v.string()),
    treatment: v.optional(v.string()),
    followUp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    const provider = await ctx.db
      .query("providers")
      .filter((q) => q.eq(q.field("userId"), args.providerId))
      .first();

    if (!provider || !provider.isActive) {
      throw new Error("Provider not found or inactive");
    }

    const patient = await ctx.db.get(args.patientId);
    if (!patient || patient.providerId !== args.providerId) {
      throw new Error("Patient not found or doesn't belong to provider");
    }

    // Update patient's weight if provided in the physical exam
    if (args.physicalExam?.weight && args.physicalExam?.weightUnit) {
      await ctx.db.patch(args.patientId, {
        weight: args.physicalExam.weight.toString(),
        weightUnit: args.physicalExam.weightUnit,
        updatedAt: timestamp,
      });
    }

    return await ctx.db.insert("encounters", {
      patientId: args.patientId,
      providerId: args.providerId,
      orgId: args.orgId,
      date: args.date,
      transcription: args.transcription,
      physicalExam: args.physicalExam,
      diagnosis: args.diagnosis,
      treatment: args.treatment,
      followUp: args.followUp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const getById = query({
  args: { id: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Indexed query by patient
export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("encounters")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();
  },
});

// Enriched query for patient timeline view
export const getByPatientWithDetails = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();

    const enriched = await Promise.all(
      encounters.map(async (c) => {
        // Count generated documents
        const docs = c.generatedDocuments || {};
        const documentCount = Object.values(docs).filter(Boolean).length;

        // Count facts
        const factCount = c.facts?.length ?? 0;

        // Get companion session summary
        const companion = await ctx.db
          .query("companionSessions")
          .withIndex("by_encounter", (q) =>
            q.eq("encounterId", c._id)
          )
          .first();

        return {
          ...c,
          documentCount,
          factCount,
          companion: companion
            ? {
                isActive: companion.isActive,
                messageCount: companion.messageCount,
                accessToken: companion.accessToken,
              }
            : null,
        };
      })
    );

    // Sort by date descending
    return enriched.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
});

// Full detail for an expanded encounter view
// Lightweight query for case reasoning - no evidence files
export const getConsultationForReasoning = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;

    // Get recordings
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
    recordings.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Compute combined facts from all recordings (deduplicated)
    const seenTexts = new Set<string>();
    const combinedFacts: Array<{ id: string; text: string; group: string }> = [];
    for (const rec of recordings) {
      if (rec.facts) {
        for (const fact of rec.facts) {
          const key = fact.text.toLowerCase().trim();
          if (!seenTexts.has(key)) {
            seenTexts.add(key);
            combinedFacts.push(fact);
          }
        }
      }
    }

    return {
      ...encounter,
      facts: combinedFacts,
      recordings,
      factReconciliation: encounter.factReconciliation,
    };
  },
});

export const getConsultationDetail = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;

    // Get companion session
    const companion = await ctx.db
      .query("companionSessions")
      .withIndex("by_encounter", (q) =>
        q.eq("encounterId", args.encounterId)
      )
      .first();

    // Get follow-ups linked to this encounter
    const followUps = await ctx.db
      .query("followUps")
      .filter((q) => q.eq(q.field("encounterId"), args.encounterId))
      .collect();

    // Get recordings
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
    recordings.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Compute combined facts from all recordings (deduplicated)
    const seenTexts = new Set<string>();
    const combinedFacts: Array<{ id: string; text: string; group: string }> = [];
    for (const rec of recordings) {
      if (rec.facts) {
        for (const fact of rec.facts) {
          const key = fact.text.toLowerCase().trim();
          if (!seenTexts.has(key)) {
            seenTexts.add(key);
            combinedFacts.push(fact);
          }
        }
      }
    }

    // Get evidence files
    const evidenceFiles = await ctx.db
      .query("evidenceFiles")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
    const evidenceWithUrls = await Promise.all(
      evidenceFiles.map(async (f) => {
        const url = await ctx.storage.getUrl(f.storageId);
        return { ...f, url };
      })
    );

    return {
      ...encounter,
      facts: combinedFacts,
      companion: companion ?? null,
      followUps,
      recordings,
      evidenceFiles: evidenceWithUrls,
    };
  },
});

// Provider-scoped encounter queries (supports date range or timeRange shortcut)
export const getVetConsultations = query({
  args: {
    userId: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    timeRange: v.optional(v.string()), // 'week', 'month', 'quarter', 'year'
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("encounters")
      .filter((q) => q.eq(q.field("providerId"), args.userId));

    // timeRange shortcut overrides explicit dates
    if (args.timeRange) {
      const now = new Date();
      const startDate = new Date();
      switch (args.timeRange) {
        case 'week': startDate.setDate(now.getDate() - 7); break;
        case 'month': startDate.setMonth(now.getMonth() - 1); break;
        case 'quarter': startDate.setMonth(now.getMonth() - 3); break;
        case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
      }
      query = query.filter((q) => q.gte(q.field("date"), startDate.toISOString()));
    } else {
      if (args.startDate !== undefined) {
        query = query.filter((q) => q.gte(q.field("date"), args.startDate!));
      }
      if (args.endDate !== undefined) {
        query = query.filter((q) => q.lte(q.field("date"), args.endDate!));
      }
    }

    return await query.collect();
  },
});

// Reusable section shape for document args
const docSectionShape = v.optional(v.object({
  sections: v.array(v.object({
    key: v.string(),
    title: v.string(),
    content: v.string(),
  })),
  generatedAt: v.string(),
}));

// Save generated documents (all 8 types) to a encounter
export const saveGeneratedDocuments = mutation({
  args: {
    encounterId: v.id("encounters"),
    soapNote: docSectionShape,
    afterVisitSummary: docSectionShape,
    dischargeInstructions: docSectionShape,
    referralLetter: docSectionShape,
    prescription: docSectionShape,
    followUpPlan: docSectionShape,
    labOrder: docSectionShape,
    shiftHandoff: docSectionShape,
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    const timestamp = new Date().toISOString();

    // Merge with existing documents if any
    const existingDocs = encounter.generatedDocuments || {};

    const docKeys = ['soapNote', 'afterVisitSummary', 'dischargeInstructions', 'referralLetter', 'prescription', 'followUpPlan', 'labOrder', 'shiftHandoff'] as const;
    const newDocs: Record<string, unknown> = { ...existingDocs };
    for (const key of docKeys) {
      if (args[key]) {
        newDocs[key] = args[key];
      }
    }

    await ctx.db.patch(args.encounterId, {
      generatedDocuments: newDocs,
      lastGeneratedAt: timestamp,
      updatedAt: timestamp,
    });

    // Audit log: document generation is a PHI access event
    await ctx.runMutation(internal.auditLogs.log, {
      orgId: encounter.orgId,
      userId: encounter.providerId,
      action: 'generate',
      resourceType: 'document',
      resourceId: args.encounterId,
      metadata: JSON.stringify({ docTypes: Object.keys(newDocs).filter(k => !!newDocs[k]) }),
    });

    return { success: true };
  },
});

// Save provider-entered diagnosis & treatment notes
export const saveVetNotes = mutation({
  args: {
    encounterId: v.id("encounters"),
    diagnosis: v.optional(v.string()),
    treatmentPlan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    const timestamp = new Date().toISOString();
    const existing = encounter.providerNotes || {};

    await ctx.db.patch(args.encounterId, {
      providerNotes: {
        diagnosis: args.diagnosis ?? existing.diagnosis,
        treatmentPlan: args.treatmentPlan ?? existing.treatmentPlan,
      },
      updatedAt: timestamp,
    });

    return { success: true };
  },
});

// Save AI diagnosis result to a encounter
export const saveDiagnosisResult = mutation({
  args: {
    encounterId: v.id("encounters"),
    diagnosisResult: v.object({
      generatedAt: v.string(),
      triage: v.optional(v.object({
        urgencyLevel: v.string(),
        redFlags: v.array(v.string()),
        recommendedWorkflow: v.string(),
        reasoning: v.string(),
      })),
      patientContext: v.optional(v.object({
        ageCategory: v.string(),
        ageInYears: v.number(),
        weightKg: v.number(),
        riskFactors: v.optional(v.array(v.string())),
      })),
      differentials: v.optional(v.object({
        differentials: v.array(v.object({
          condition: v.string(),
          probability: v.string(),
          reasoning: v.string(),
          supportingEvidence: v.optional(v.array(v.string())),
          contradictingEvidence: v.optional(v.array(v.string())),
        })),
        keyFindings: v.array(v.string()),
      })),
      tests: v.optional(v.object({
        recommendedTests: v.array(v.object({
          test: v.string(),
          priority: v.string(),
          rationale: v.string(),
          targetConditions: v.optional(v.array(v.string())),
        })),
        suggestedPanel: v.optional(v.string()),
      })),
      treatments: v.optional(v.object({
        medications: v.array(v.object({
          drug: v.string(),
          drugClass: v.optional(v.string()),
          dose: v.string(),
          route: v.string(),
          frequency: v.string(),
          duration: v.string(),
          doseCalculation: v.optional(v.string()),
        })),
        supportiveCare: v.optional(v.array(v.string())),
        patientInstructions: v.optional(v.array(v.string())),
        warningSignsForPatient: v.optional(v.array(v.string())),
        followUpRecommendation: v.optional(v.object({
          timing: v.string(),
          purpose: v.string(),
        })),
      })),
      agentTrace: v.optional(v.array(v.object({
        agent: v.string(),
        status: v.string(),
        duration: v.number(),
      }))),
    }),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    await ctx.db.patch(args.encounterId, {
      diagnosisResult: args.diagnosisResult,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// Save a single case reasoning tool result (merges into caseReasoning without overwriting others)
export const saveCaseReasoningResult = mutation({
  args: {
    encounterId: v.id("encounters"),
    tool: v.string(), // 'differentials' | 'diagnosticTests' | 'drugInteractions' | 'literatureSearch'
    result: v.any(),
    generatedAt: v.string(),
    duration: v.number(),
    usedDifferentials: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    const existing = encounter.caseReasoning || {};
    const toolData: Record<string, unknown> = {
      result: args.result,
      generatedAt: args.generatedAt,
      duration: args.duration,
    };
    if (args.usedDifferentials !== undefined) {
      toolData.usedDifferentials = args.usedDifferentials;
    }

    await ctx.db.patch(args.encounterId, {
      caseReasoning: {
        ...existing,
        [args.tool]: toolData,
      },
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// Get a encounter by interactionId (used during document generation flow)
export const getByInteractionId = query({
  args: { interactionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("encounters")
      .filter((q) => q.eq(q.field("interactionId"), args.interactionId))
      .first();
  },
});

// Org-scoped encounter queries (supports date range or timeRange shortcut)
export const getConsultationsByOrg = query({
  args: {
    orgId: v.id("organizations"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    timeRange: v.optional(v.string()), // 'week', 'month', 'quarter', 'year'
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("encounters")
      .withIndex("by_org", (qb) => qb.eq("orgId", args.orgId));

    if (args.timeRange) {
      const now = new Date();
      const startDate = new Date();
      switch (args.timeRange) {
        case "week": startDate.setDate(now.getDate() - 7); break;
        case "month": startDate.setMonth(now.getMonth() - 1); break;
        case "quarter": startDate.setMonth(now.getMonth() - 3); break;
        case "year": startDate.setFullYear(now.getFullYear() - 1); break;
      }
      q = q.filter((f) => f.gte(f.field("date"), startDate.toISOString()));
    } else {
      if (args.startDate !== undefined) {
        q = q.filter((f) => f.gte(f.field("date"), args.startDate!));
      }
      if (args.endDate !== undefined) {
        q = q.filter((f) => f.lte(f.field("date"), args.endDate!));
      }
    }

    return await q.collect();
  },
});

// ============================================================================
// Encounter Lifecycle (Phase 2: Continuous Encounter)
// ============================================================================

// Create a draft encounter (no patient required initially)
export const createDraftConsultation = mutation({
  args: {
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")),
    patientId: v.optional(v.id("patients")),
    reasonForVisit: v.optional(v.string()),
    appointmentTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    // If patientId provided, verify ownership
    if (args.patientId) {
      const patient = await ctx.db.get(args.patientId);
      if (!patient || patient.providerId !== args.providerId) {
        throw new Error("Patient not found or doesn't belong to provider");
      }
    }

    const encounterId = await ctx.db.insert("encounters", {
      // Use a placeholder patient if none provided — will be linked later
      patientId: args.patientId as Id<"patients">,
      providerId: args.providerId,
      orgId: args.orgId,
      date: timestamp.split('T')[0],
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'draft',
      reasonForVisit: args.reasonForVisit,
      appointmentTime: args.appointmentTime,
    });

    return encounterId;
  },
});

// Update encounter status with lifecycle validation
// Valid transitions: draft→in-progress, in-progress→review, review→published, review→in-progress
export const updateConsultationStatus = mutation({
  args: {
    encounterId: v.id("encounters"),
    status: v.string(), // 'draft' | 'in-progress' | 'review' | 'published'
    userId: v.optional(v.string()), // Clerk userId, required for publishing
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const currentStatus = encounter.status || 'draft';

    // Validate allowed transitions
    const validTransitions: Record<string, string[]> = {
      'draft': ['in-progress'],
      'in-progress': ['review', 'published'],
      'review': ['published', 'in-progress'],
      'published': ['in-progress'],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(args.status)) {
      throw new Error(`Invalid status transition: ${currentStatus} → ${args.status}`);
    }

    const timestamp = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: timestamp,
    };

    // Set publish metadata when publishing
    if (args.status === 'published') {
      patch.publishedAt = timestamp;
      patch.publishedBy = args.userId;
    }

    await ctx.db.patch(args.encounterId, patch);

    return { success: true };
  },
});

// Get encounter with all recordings and related data
export const getConsultationWithRecordings = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;

    // Get recordings
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
    recordings.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Get companion session
    const companion = await ctx.db
      .query("companionSessions")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .first();

    // Get follow-ups
    const followUps = await ctx.db
      .query("followUps")
      .filter((q) => q.eq(q.field("encounterId"), args.encounterId))
      .collect();

    // Compute combined facts (deduped across recordings)
    const seenTexts = new Set<string>();
    const combinedFacts: Array<{ id: string; text: string; group: string }> = [];
    for (const rec of recordings) {
      if (rec.facts) {
        for (const fact of rec.facts) {
          const key = fact.text.toLowerCase().trim();
          if (!seenTexts.has(key)) {
            seenTexts.add(key);
            combinedFacts.push(fact);
          }
        }
      }
    }

    // Compute total duration
    const totalDuration = recordings.reduce((sum, r) => sum + (r.duration || 0), 0);

    // Combined transcript
    const combinedTranscript = recordings
      .filter(r => r.transcript)
      .map(r => r.transcript!)
      .join('\n\n---\n\n');

    return {
      ...encounter,
      recordings,
      companion: companion ?? null,
      followUps,
      combinedFacts,
      combinedTranscript: combinedTranscript || encounter.transcription || '',
      totalDuration,
    };
  },
});

// Get draft/in-progress/review encounters for a provider/org (not published)
export const getDraftConsultations = query({
  args: {
    providerId: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    let results;

    const activeStatuses = new Set(['draft', 'in-progress', 'review']);

    if (args.orgId) {
      results = await ctx.db
        .query("encounters")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId!))
        .filter((q) =>
          q.or(
            q.eq(q.field("status"), "draft"),
            q.eq(q.field("status"), "in-progress"),
            q.eq(q.field("status"), "review")
          )
        )
        .collect();
    } else if (args.providerId) {
      results = await ctx.db
        .query("encounters")
        .filter((q) =>
          q.and(
            q.eq(q.field("providerId"), args.providerId!),
            q.or(
              q.eq(q.field("status"), "draft"),
              q.eq(q.field("status"), "in-progress"),
              q.eq(q.field("status"), "review")
            )
          )
        )
        .collect();
    } else {
      return [];
    }

    // Enrich with recording counts and patient info
    const enriched = await Promise.all(
      results.map(async (c) => {
        const recordings = await ctx.db
          .query("recordings")
          .withIndex("by_encounter", (q) => q.eq("encounterId", c._id))
          .collect();

        const evidenceFiles = await ctx.db
          .query("evidenceFiles")
          .withIndex("by_encounter", (q) => q.eq("encounterId", c._id))
          .collect();

        // Get patient info if available
        let patientName: string | null = null;
        let patientAge: string | null = null;
        if (c.patientId) {
          const patient = await ctx.db.get(c.patientId) as { name?: string; age?: string } | null;
          patientName = patient?.name ?? null;
          patientAge = patient?.age ?? null;
        }

        const factCount = recordings.reduce((sum, r) => sum + (r.facts?.length || 0), 0);

        return {
          ...c,
          recordingCount: recordings.length,
          factCount,
          evidenceCount: evidenceFiles.length,
          patientName,
          patientAge,
        };
      })
    );

    // Earliest first: appointments first by time, then remaining by creation date
    return enriched.sort((a, b) => {
      const aTime = a.appointmentTime || a.createdAt;
      const bTime = b.appointmentTime || b.createdAt;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
  },
});

// Update lastGeneratedAt timestamp
export const updateLastGeneratedAt = mutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");
    await ctx.db.patch(args.encounterId, {
      lastGeneratedAt: new Date().toISOString(),
    });
  },
});

// Search encounters for a patient by text across transcripts, facts, and diagnosis
export const searchByPatient = query({
  args: {
    patientId: v.id("patients"),
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    const term = args.searchTerm.toLowerCase().trim();
    if (!term) return [];

    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();

    const results = encounters
      .map((c) => {
        const matchSnippets: string[] = [];

        // Search in transcription
        if (c.transcription && c.transcription.toLowerCase().includes(term)) {
          const idx = c.transcription.toLowerCase().indexOf(term);
          const start = Math.max(0, idx - 40);
          const end = Math.min(c.transcription.length, idx + term.length + 40);
          matchSnippets.push(`...${c.transcription.slice(start, end)}...`);
        }

        // Search in facts
        if (c.facts) {
          for (const fact of c.facts) {
            if (fact.text.toLowerCase().includes(term)) {
              matchSnippets.push(fact.text);
            }
          }
        }

        // Search in diagnosis
        if (c.diagnosis && c.diagnosis.toLowerCase().includes(term)) {
          matchSnippets.push(c.diagnosis.slice(0, 100));
        }

        if (matchSnippets.length === 0) return null;

        return {
          _id: c._id,
          date: c.date,
          diagnosis: c.diagnosis,
          factCount: c.facts?.length ?? 0,
          matchSnippets: matchSnippets.slice(0, 3),
          status: c.status,
        };
      })
      .filter(Boolean);

    return results.sort(
      (a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime()
    );
  },
});

// Get prior encounters for context (non-draft, for a given patient)
export const getPriorConsultations = query({
  args: {
    patientId: v.id("patients"),
    excludeConsultationId: v.optional(v.id("encounters")),
  },
  handler: async (ctx, args) => {
    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();

    return encounters
      .filter((c) => {
        // Exclude drafts and the current encounter
        if (c.status === 'draft') return false;
        if (args.excludeConsultationId && c._id === args.excludeConsultationId) return false;
        return true;
      })
      .map((c) => ({
        _id: c._id,
        date: c.date,
        diagnosis: c.diagnosis,
        factCount: c.facts?.length ?? 0,
        facts: c.facts || [],
        status: c.status,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
});

// Get draft encounter for a specific patient
export const getDraftByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("encounters")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .filter((q) => q.eq(q.field("status"), "draft"))
      .first();
  },
});

// ============================================================================
// Draft Encounter Lifecycle — Phase 1
// ============================================================================

// Publish a encounter (review → published)
export const publishConsultation = mutation({
  args: {
    encounterId: v.id("encounters"),
    userId: v.string(), // Clerk userId
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    if (encounter.status !== 'review' && encounter.status !== 'in-progress') {
      throw new Error(`Cannot publish encounter with status '${encounter.status}'. Must be in 'in-progress' or 'review' status.`);
    }

    // Aggregate final facts from all recordings (dedup)
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const seenTexts = new Set<string>();
    const mergedFacts: Array<{ id: string; text: string; group: string }> = [];
    for (const rec of recordings) {
      if (rec.facts) {
        for (const fact of rec.facts) {
          const key = fact.text.toLowerCase().trim();
          if (!seenTexts.has(key)) {
            seenTexts.add(key);
            mergedFacts.push(fact);
          }
        }
      }
    }

    const timestamp = new Date().toISOString();

    await ctx.db.patch(args.encounterId, {
      status: 'published',
      publishedAt: timestamp,
      publishedBy: args.userId,
      facts: mergedFacts,
      updatedAt: timestamp,
    });

    return args.encounterId;
  },
});

// Unpublish a encounter (published → in-progress)
export const unpublishConsultation = mutation({
  args: {
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    if (encounter.status !== 'published') {
      throw new Error(`Cannot unpublish encounter with status '${encounter.status}'. Must be in 'published' status.`);
    }

    const timestamp = new Date().toISOString();

    await ctx.db.patch(args.encounterId, {
      status: 'in-progress',
      publishedAt: undefined,
      publishedBy: undefined,
      updatedAt: timestamp,
    });

    return args.encounterId;
  },
});

// Add addendum to any encounter
export const addAddendum = mutation({
  args: {
    encounterId: v.id("encounters"),
    text: v.string(),
    providerId: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const timestamp = new Date().toISOString();
    const existingAddenda = encounter.addenda || [];
    const noteIndex = existingAddenda.length; // 0-based index of the new note

    await ctx.db.patch(args.encounterId, {
      addenda: [...existingAddenda, {
        text: args.text,
        providerId: args.providerId,
        createdAt: timestamp,
      }],
      updatedAt: timestamp,
    });

    // Trigger billing extraction from note text in the background
    if (encounter.orgId) {
      await ctx.scheduler.runAfter(0, api.billingExtraction.extractFromNote, {
        encounterId: args.encounterId,
        orgId: encounter.orgId,
        userId: args.providerId,
        noteText: args.text,
        noteIndex,
      });
    }

    return { success: true };
  },
});

// Update draft details (reason, appointment, patient)
export const updateDraftDetails = mutation({
  args: {
    encounterId: v.id("encounters"),
    reasonForVisit: v.optional(v.string()),
    appointmentTime: v.optional(v.string()),
    patientId: v.optional(v.id("patients")),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    if (encounter.status === 'published') {
      throw new Error("Cannot update details of a published encounter.");
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (args.reasonForVisit !== undefined) patch.reasonForVisit = args.reasonForVisit;
    if (args.appointmentTime !== undefined) patch.appointmentTime = args.appointmentTime;
    if (args.patientId !== undefined) patch.patientId = args.patientId;

    await ctx.db.patch(args.encounterId, patch);
    return { success: true };
  },
});

// Get published encounters for a provider/org
export const getPublishedConsultations = query({
  args: {
    providerId: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxResults = args.limit ?? 20;
    let results;

    if (args.orgId) {
      results = await ctx.db
        .query("encounters")
        .withIndex("by_status_org", (q) =>
          q.eq("status", "published").eq("orgId", args.orgId!)
        )
        .collect();
    } else if (args.providerId) {
      results = await ctx.db
        .query("encounters")
        .filter((q) =>
          q.and(
            q.eq(q.field("providerId"), args.providerId!),
            q.eq(q.field("status"), "published")
          )
        )
        .collect();
    } else {
      return [];
    }

    // Sort by publishedAt descending and limit
    results.sort(
      (a, b) =>
        new Date(b.publishedAt || b.updatedAt).getTime() -
        new Date(a.publishedAt || a.updatedAt).getTime()
    );
    results = results.slice(0, maxResults);

    // Enrich
    const enriched = await Promise.all(
      results.map(async (c) => {
        const recordings = await ctx.db
          .query("recordings")
          .withIndex("by_encounter", (q) => q.eq("encounterId", c._id))
          .collect();

        // Get patient info
        let patientName: string | null = null;
        if (c.patientId) {
          const patient = await ctx.db.get(c.patientId) as { name?: string } | null;
          patientName = patient?.name ?? null;
        }

        // Count documents
        const docs = c.generatedDocuments || {};
        const documentCount = Object.values(docs).filter(Boolean).length;

        // Get companion
        const companion = await ctx.db
          .query("companionSessions")
          .withIndex("by_encounter", (q) => q.eq("encounterId", c._id))
          .first();

        return {
          _id: c._id,
          patientId: c.patientId,
          patientName,
          date: c.date,
          publishedAt: c.publishedAt,
          recordingCount: recordings.length,
          factCount: c.facts?.length ?? 0,
          documentCount,
          hasCompanion: !!companion,
          companionActive: companion?.isActive ?? false,
          companionAccessToken: companion?.accessToken ?? null,
          addendaCount: c.addenda?.length ?? 0,
          reasonForVisit: c.reasonForVisit,
        };
      })
    );

    return enriched;
  },
});

// Delete a draft encounter
export const deleteDraftConsultation = mutation({
  args: {
    encounterId: v.id("encounters"),
    forceDelete: v.optional(v.boolean()), // Admin override — allows deleting any status
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    if (!args.forceDelete && encounter.status !== 'draft') {
      throw new Error("Only draft encounters can be deleted. Admins can force-delete.");
    }

    // Delete associated recordings
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
    for (const rec of recordings) {
      await ctx.db.delete(rec._id);
    }

    // Delete associated evidence files
    const evidenceFiles = await ctx.db
      .query("evidenceFiles")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
    for (const ef of evidenceFiles) {
      await ctx.db.delete(ef._id);
    }

    // Delete associated companion sessions
    const companions = await ctx.db
      .query("companionSessions")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
    for (const c of companions) {
      await ctx.db.delete(c._id);
    }

    // Delete associated follow-ups
    const followUps = await ctx.db
      .query("followUps")
      .filter((q) => q.eq(q.field("encounterId"), args.encounterId))
      .collect();
    for (const fu of followUps) {
      await ctx.db.delete(fu._id);
    }

    await ctx.db.delete(args.encounterId);
    return { success: true };
  },
});

// Clear extractedPatientInfo after enrichment accept/dismiss
export const clearExtractedPatientInfo = mutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    await ctx.db.patch(args.encounterId, {
      extractedPatientInfo: undefined,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// ============================================================================
// Medical Coding
// ============================================================================

export const updateMedicalCodes = mutation({
  args: {
    encounterId: v.id("encounters"),
    icd10Codes: v.optional(v.array(v.string())),
    cptCodes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.icd10Codes !== undefined) patch.icd10Codes = args.icd10Codes;
    if (args.cptCodes !== undefined) patch.cptCodes = args.cptCodes;

    await ctx.db.patch(args.encounterId, patch);
    return { success: true };
  },
});

// ============================================================================
// Document Editing
// ============================================================================

// Update a single section's content within a generated document
export const updateDocumentSection = mutation({
  args: {
    encounterId: v.id("encounters"),
    docKey: v.string(), // e.g. 'soapNote', 'afterVisitSummary'
    sectionIndex: v.number(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const docs = encounter.generatedDocuments as Record<string, { sections: Array<{ key: string; title: string; content: string }>; generatedAt: string }> | undefined;
    if (!docs || !docs[args.docKey]) {
      throw new Error(`Document '${args.docKey}' not found`);
    }

    const doc = docs[args.docKey];
    if (args.sectionIndex < 0 || args.sectionIndex >= doc.sections.length) {
      throw new Error(`Section index ${args.sectionIndex} out of range`);
    }

    // Update the section content
    const updatedSections = [...doc.sections];
    updatedSections[args.sectionIndex] = {
      ...updatedSections[args.sectionIndex],
      content: args.content,
    };

    await ctx.db.patch(args.encounterId, {
      generatedDocuments: {
        ...docs,
        [args.docKey]: {
          ...doc,
          sections: updatedSections,
        },
      },
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// ============================================================================
// Fact Reconciliation
// ============================================================================

// Save fact reconciliation result from AI agent
export const saveFactReconciliation = mutation({
  args: {
    encounterId: v.id("encounters"),
    factReconciliation: v.object({
      reconciledFacts: v.array(v.object({
        factId: v.string(),
        text: v.string(),
        group: v.string(),
        status: v.string(),
        recordingIndex: v.number(),
        priorFactId: v.optional(v.string()),
        priorText: v.optional(v.string()),
        priorRecordingIndex: v.optional(v.number()),
        resolution: v.optional(v.string()),
        resolvedAt: v.optional(v.string()),
      })),
      summary: v.object({
        confirmed: v.number(),
        updated: v.number(),
        contradicted: v.number(),
        new: v.number(),
        unchanged: v.number(),
      }),
      reconciledAt: v.string(),
      triggerRecordingCount: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    await ctx.db.patch(args.encounterId, {
      factReconciliation: args.factReconciliation,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// Resolve a single fact conflict (accept-new or keep-old)
export const resolveFactConflict = mutation({
  args: {
    encounterId: v.id("encounters"),
    factId: v.string(),
    resolution: v.string(), // 'accept-new' | 'keep-old'
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");
    if (!encounter.factReconciliation) throw new Error("No reconciliation data");

    const updatedFacts = encounter.factReconciliation.reconciledFacts.map(f => {
      if (f.factId === args.factId) {
        return {
          ...f,
          resolution: args.resolution,
          resolvedAt: new Date().toISOString(),
        };
      }
      return f;
    });

    await ctx.db.patch(args.encounterId, {
      factReconciliation: {
        ...encounter.factReconciliation,
        reconciledFacts: updatedFacts,
      },
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// One-time migration: old diagnosisResult shape → new shape
export const migrateDiagnosisResults = mutation({
  handler: async (ctx) => {
    const encounters = await ctx.db
      .query("encounters")
      .filter((q) => q.neq(q.field("diagnosisResult"), undefined))
      .collect();

    let count = 0;
    for (const c of encounters) {
      const dr = c.diagnosisResult as Record<string, unknown> | undefined;
      if (!dr) continue;

      // Already migrated (has generatedAt)
      if (dr.generatedAt) continue;

      // Old shape had: triage, differentials (array), recommendedTests (array), medications (array)
      // New shape: triage, patientContext, differentials (object), tests (object), treatments (object), generatedAt

      const oldDiffs = dr.differentials as Array<{ condition: string; probability: string; reasoning: string }> | undefined;
      const oldTests = dr.recommendedTests as Array<{ test: string; priority: string; rationale: string }> | undefined;
      const oldMeds = dr.medications as Array<{ drug: string; dose: string; route: string; frequency: string; duration: string }> | undefined;

      const newResult = {
        generatedAt: c.updatedAt || new Date().toISOString(),
        triage: dr.triage as { urgencyLevel: string; redFlags: string[]; recommendedWorkflow: string; reasoning: string } | undefined,
        differentials: oldDiffs ? {
          differentials: oldDiffs.map(d => ({
            condition: d.condition,
            probability: d.probability,
            reasoning: d.reasoning,
          })),
          keyFindings: [] as string[],
        } : undefined,
        tests: oldTests ? {
          recommendedTests: oldTests.map(t => ({
            test: t.test,
            priority: t.priority,
            rationale: t.rationale,
          })),
        } : undefined,
        treatments: oldMeds ? {
          medications: oldMeds.map(m => ({
            drug: m.drug,
            dose: m.dose,
            route: m.route,
            frequency: m.frequency,
            duration: m.duration,
          })),
        } : undefined,
      };

      await ctx.db.patch(c._id, {
        diagnosisResult: newResult,
        updatedAt: new Date().toISOString(),
      });
      count++;
    }

    return { migrated: count };
  },
});

// Persist Epic FHIR IDs after SMART launch
export const setEpicIds = mutation({
  args: {
    encounterId: v.id("encounters"),
    epicPatientId: v.optional(v.string()),
    epicEncounterId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");
    const patch: Record<string, string | undefined> = { updatedAt: new Date().toISOString() };
    if (args.epicPatientId !== undefined) patch.epicPatientId = args.epicPatientId;
    if (args.epicEncounterId !== undefined) patch.epicEncounterId = args.epicEncounterId;
    await ctx.db.patch(args.encounterId, patch);
  },
});

// One-time migration: finalized → published
export const migrateFinalized = mutation({
  handler: async (ctx) => {
    const finalized = await ctx.db
      .query("encounters")
      .filter((q) => q.eq(q.field("status"), "finalized"))
      .collect();

    let count = 0;
    for (const c of finalized) {
      await ctx.db.patch(c._id, {
        status: 'published',
        publishedAt: c.updatedAt,
      });
      count++;
    }

    return { migrated: count };
  },
});