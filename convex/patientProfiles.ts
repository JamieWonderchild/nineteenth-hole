import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Public action: Build (or rebuild) the living patient profile.
 * Called after every encounter publish, and can be triggered manually.
 */
export const buildPatientProfile = action({
  args: {
    patientId: v.id("patients"),
    encounterId: v.id("encounters"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    console.log(`[PatientProfile] Building profile for patient ${args.patientId}`);

    try {
      // Step 1: Assemble patient + encounter context
      const contextData = await ctx.runMutation(
        internal.patientProfiles.getPatientContextData,
        { patientId: args.patientId }
      );

      if (!contextData) {
        return { success: false, error: 'Patient not found' };
      }

      if (contextData.encounters.length === 0) {
        console.log('[PatientProfile] No published encounters yet, skipping');
        await ctx.runMutation(internal.patientProfiles.updateBuildStatus, {
          patientId: args.patientId,
          orgId: args.orgId,
          encounterId: args.encounterId,
          status: 'completed',
        });
        return { success: true };
      }

      // Step 2: Call Corti agent via API route
      // If a profile already exists, only send the new encounter as a delta update.
      // Otherwise, send all encounters for the initial synthesis.
      const apiUrl = process.env.SITE_URL || 'https://healthplatform.com';
      const response = await fetch(`${apiUrl}/api/corti/build-patient-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientInfo: contextData.patientInfo,
          encounters: contextData.encounters,
          existingProfile: contextData.existingProfile ?? null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PatientProfile] API error:', errorText.substring(0, 300));
        await ctx.runMutation(internal.patientProfiles.updateBuildStatus, {
          patientId: args.patientId,
          orgId: args.orgId,
          encounterId: args.encounterId,
          status: 'failed',
        });
        return { success: false, error: `API error: ${response.status}` };
      }

      const { profile } = await response.json();

      if (!profile) {
        return { success: false, error: 'Invalid profile response' };
      }

      // Step 3: Upsert the profile
      await ctx.runMutation(internal.patientProfiles.saveProfile, {
        patientId: args.patientId,
        orgId: args.orgId,
        encounterId: args.encounterId,
        encounterCount: contextData.encounters.length,
        lastEncounterDate: contextData.encounters[0]?.date ?? new Date().toISOString().split('T')[0],
        profile,
      });

      console.log(`[PatientProfile] Profile built from ${contextData.encounters.length} encounters`);
      return { success: true };

    } catch (error) {
      console.error('[PatientProfile] Fatal error:', error);
      await ctx.runMutation(internal.patientProfiles.updateBuildStatus, {
        patientId: args.patientId,
        orgId: args.orgId,
        encounterId: args.encounterId,
        status: 'failed',
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});

/**
 * Internal: Assemble patient demographics + published encounter summaries
 */
export const getPatientContextData = internalMutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) return null;

    const patientInfo = {
      name: patient.name,
      age: patient.age ?? undefined,
      sex: patient.sex ?? undefined,
      weight: patient.weight ?? undefined,
      allergies: patient.allergies ?? [],
    };

    // Check if a completed profile already exists
    const existingProfile = await ctx.db
      .query("patientProfiles")
      .withIndex("by_patient", q => q.eq("patientId", args.patientId))
      .first();

    const hasExistingProfile = existingProfile?.buildStatus === 'completed' &&
      existingProfile.clinicalNarrative !== '';

    // If a profile exists, only fetch the newest encounter for an incremental update.
    // Otherwise fetch all published encounters for initial synthesis (cap at 20).
    const rawEncounters = await ctx.db
      .query("encounters")
      .withIndex("by_patient_status", q =>
        q.eq("patientId", args.patientId).eq("status", "published")
      )
      .order("desc")
      .take(hasExistingProfile ? 1 : 20);

    const mapEncounter = (enc: typeof rawEncounters[0]) => {
      const keyFacts: Record<string, string[]> = {};
      const PROFILE_GROUPS = ['medications', 'allergies', 'assessment', 'plan', 'past-medical-history', 'chief-complaint'];
      for (const fact of enc.facts ?? []) {
        if (PROFILE_GROUPS.includes(fact.group)) {
          if (!keyFacts[fact.group]) keyFacts[fact.group] = [];
          keyFacts[fact.group].push(fact.text);
        }
      }
      const planSection = enc.generatedDocuments?.soapNote?.sections?.find(
        (s: { key: string; content: string }) => s.key === 'corti-plan'
      );
      return {
        date: enc.date ?? enc.createdAt?.split('T')[0] ?? 'unknown',
        chiefComplaint: enc.chiefComplaint ?? enc.reasonForVisit ?? undefined,
        icd10Codes: enc.icd10Codes ?? [],
        keyFacts,
        planText: planSection?.content?.substring(0, 500) ?? undefined,
      };
    };

    const encounters = rawEncounters.map(mapEncounter);

    // Strip internal Convex fields before passing to the agent
    const profileForAgent = hasExistingProfile ? {
      activeProblems: existingProfile.activeProblems,
      currentMedications: existingProfile.currentMedications,
      allergies: existingProfile.allergies,
      riskFactors: existingProfile.riskFactors,
      clinicalNarrative: existingProfile.clinicalNarrative,
      careGaps: existingProfile.careGaps,
      keyHistory: existingProfile.keyHistory,
    } : null;

    return { patientInfo, encounters, existingProfile: profileForAgent };
  },
});

/**
 * Internal: Upsert the patient profile record
 */
export const saveProfile = internalMutation({
  args: {
    patientId: v.id("patients"),
    orgId: v.id("organizations"),
    encounterId: v.id("encounters"),
    encounterCount: v.number(),
    lastEncounterDate: v.string(),
    profile: v.object({
      activeProblems: v.array(v.object({
        condition: v.string(),
        icd10Code: v.optional(v.any()),
        status: v.string(),
        onsetDate: v.optional(v.any()),
        lastMentionedDate: v.string(),
        notes: v.optional(v.any()),
      })),
      currentMedications: v.array(v.object({
        drug: v.string(),
        dose: v.optional(v.any()),
        frequency: v.optional(v.any()),
        route: v.optional(v.any()),
        startDate: v.optional(v.any()),
      })),
      allergies: v.array(v.object({
        allergen: v.string(),
        reaction: v.optional(v.any()),
        severity: v.optional(v.any()),
      })),
      riskFactors: v.array(v.string()),
      clinicalNarrative: v.string(),
      careGaps: v.array(v.object({
        description: v.string(),
        priority: v.string(),
        lastScreeningDate: v.optional(v.any()),
      })),
      keyHistory: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    // Normalize nulls out of optional fields
    const normalizeProblems = args.profile.activeProblems.map(p => ({
      condition: p.condition,
      icd10Code: p.icd10Code ?? undefined,
      status: p.status,
      onsetDate: p.onsetDate ?? undefined,
      lastMentionedDate: p.lastMentionedDate,
      notes: p.notes ?? undefined,
    }));

    const normalizeMeds = args.profile.currentMedications.map(m => ({
      drug: m.drug,
      dose: m.dose ?? undefined,
      frequency: m.frequency ?? undefined,
      route: m.route ?? undefined,
      startDate: m.startDate ?? undefined,
    }));

    const normalizeAllergies = args.profile.allergies.map(a => ({
      allergen: a.allergen,
      reaction: a.reaction ?? undefined,
      severity: a.severity ?? undefined,
    }));

    const normalizeCareGaps = args.profile.careGaps.map(g => ({
      description: g.description,
      priority: g.priority,
      lastScreeningDate: g.lastScreeningDate ?? undefined,
    }));

    const profileData = {
      patientId: args.patientId,
      orgId: args.orgId,
      activeProblems: normalizeProblems,
      currentMedications: normalizeMeds,
      allergies: normalizeAllergies,
      riskFactors: args.profile.riskFactors,
      clinicalNarrative: args.profile.clinicalNarrative,
      careGaps: normalizeCareGaps,
      keyHistory: args.profile.keyHistory,
      generatedAt: timestamp,
      triggerEncounterId: args.encounterId,
      encounterCount: args.encounterCount,
      lastEncounterDate: args.lastEncounterDate,
      buildStatus: 'completed',
    };

    const existing = await ctx.db
      .query("patientProfiles")
      .withIndex("by_patient", q => q.eq("patientId", args.patientId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, profileData);
    } else {
      await ctx.db.insert("patientProfiles", profileData);
    }
  },
});

/**
 * Internal: Update build status without changing profile content (used for loading state)
 */
export const updateBuildStatus = internalMutation({
  args: {
    patientId: v.id("patients"),
    orgId: v.id("organizations"),
    encounterId: v.id("encounters"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("patientProfiles")
      .withIndex("by_patient", q => q.eq("patientId", args.patientId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { buildStatus: args.status });
    } else if (args.status === 'processing') {
      // Create placeholder so UI can show loading state immediately
      await ctx.db.insert("patientProfiles", {
        patientId: args.patientId,
        orgId: args.orgId,
        activeProblems: [],
        currentMedications: [],
        allergies: [],
        riskFactors: [],
        clinicalNarrative: '',
        careGaps: [],
        keyHistory: '',
        generatedAt: new Date().toISOString(),
        triggerEncounterId: args.encounterId,
        encounterCount: 0,
        lastEncounterDate: new Date().toISOString().split('T')[0],
        buildStatus: 'processing',
      });
    }
  },
});

/**
 * Public: Set status to 'processing' immediately when publish triggers a rebuild.
 * Called synchronously from publishConsultation so the UI can show a loading state.
 */
export const markProcessing = mutation({
  args: {
    patientId: v.id("patients"),
    orgId: v.id("organizations"),
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("patientProfiles")
      .withIndex("by_patient", q => q.eq("patientId", args.patientId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { buildStatus: 'processing' });
    } else {
      await ctx.db.insert("patientProfiles", {
        patientId: args.patientId,
        orgId: args.orgId,
        activeProblems: [],
        currentMedications: [],
        allergies: [],
        riskFactors: [],
        clinicalNarrative: '',
        careGaps: [],
        keyHistory: '',
        generatedAt: new Date().toISOString(),
        triggerEncounterId: args.encounterId,
        encounterCount: 0,
        lastEncounterDate: new Date().toISOString().split('T')[0],
        buildStatus: 'processing',
      });
    }
  },
});

/**
 * Get the full patient profile for display
 */
export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("patientProfiles")
      .withIndex("by_patient", q => q.eq("patientId", args.patientId))
      .first();
  },
});

/**
 * Internal: Find all patients in the org whose profile is missing or stale.
 * A profile is stale when the latest published encounter was after the profile was generated.
 * Returns up to 20, prioritised by most recent encounter.
 */
export const getPatientsNeedingProfiles = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const patients = await ctx.db
      .query("patients")
      .withIndex("by_org", q => q.eq("orgId", args.orgId))
      .collect();

    const needing: Array<{
      patientId: Id<"patients">;
      encounterId: Id<"encounters">;
      publishedAt: string;
    }> = [];

    for (const patient of patients) {
      const latestEncounter = await ctx.db
        .query("encounters")
        .withIndex("by_patient_status", q =>
          q.eq("patientId", patient._id).eq("status", "published")
        )
        .order("desc")
        .first();

      if (!latestEncounter) continue;

      const profile = await ctx.db
        .query("patientProfiles")
        .withIndex("by_patient", q => q.eq("patientId", patient._id))
        .first();

      const needsBuild =
        !profile ||
        profile.buildStatus === 'failed' ||
        (profile.buildStatus === 'completed' &&
          latestEncounter.publishedAt != null &&
          profile.generatedAt < latestEncounter.publishedAt);

      if (needsBuild) {
        needing.push({
          patientId: patient._id,
          encounterId: latestEncounter._id,
          publishedAt: latestEncounter.publishedAt ?? latestEncounter._creationTime.toString(),
        });
      }
    }

    // Sort by most recent encounter first, cap at 20
    return needing
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 20);
  },
});

/**
 * Public: Catch up profile builds for all patients in the org.
 * Schedules builds staggered 3s apart so we don't hammer the Corti API.
 * Designed to be called once per session from the UI with a client-side cooldown.
 */
export const catchUpPatientProfiles = action({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<{ triggered: number }> => {
    const patients = await ctx.runQuery(
      internal.patientProfiles.getPatientsNeedingProfiles,
      { orgId: args.orgId }
    );

    if (patients.length === 0) return { triggered: 0 };

    for (let i = 0; i < patients.length; i++) {
      await ctx.scheduler.runAfter(
        i * 3000, // stagger 3s apart
        api.patientProfiles.buildPatientProfile,
        {
          patientId: patients[i].patientId,
          orgId: args.orgId,
          encounterId: patients[i].encounterId,
        }
      );
    }

    console.log(`[ProfileCatchUp] Scheduled ${patients.length} profile build(s) for org ${args.orgId}`);
    return { triggered: patients.length };
  },
});
