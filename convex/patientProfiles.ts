import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const PATIENT_PROFILE_SECTIONS = [
  {
    key: 'corti-subjective',
    nameOverride: 'Overview',
    contentOverride: 'Include: patient demographics, major chronic conditions, allergy status, key background history. Exclude: recent visit details, pending items, treatment plans.',
    writingStyleOverride: 'Dense clinical shorthand, as if handing off to a colleague. No padding.',
    additionalInstructionsOverride: `Write 2-3 sentences maximum. Cover: who the patient is (age, sex), their major ongoing conditions, and allergy status.\nExample: "58M with T2DM (poorly controlled), primary hypertension, and new hyperlipidaemia. NKDA. No prior hospitalisations documented."\nDo not mention recent visits or pending actions here.`,
  },
  {
    key: 'corti-assessment',
    nameOverride: 'Recent',
    contentOverride: 'Include: last 1-2 encounter dates, chief complaint, key findings, diagnoses made, what was started or changed. Exclude: chronic background, medications unchanged, pending follow-up items.',
    writingStyleOverride: 'Tight clinical narrative, past tense, dense.',
    additionalInstructionsOverride: `Summarise the most recent encounter(s) in 2-4 sentences.\nCover: why the patient came in, what was found, what was diagnosed or changed, what was ordered or started.\nExample: "Seen 2026-04-05 for fatigue and exertional SOB. HbA1c 8.4%, LDL 3.8, mild normocytic anaemia (Hb 11.8). Metformin uptitrated to 1g BD, atorvastatin 40mg nocte started. Iron studies, 24h Holter, and cardiology referral placed."\nIf multiple encounters, summarise the most recent first.`,
  },
  {
    key: 'corti-plan',
    nameOverride: 'Watch',
    contentOverride: 'Include: pending results, outstanding referrals, unresolved issues, items to monitor at next visit. Exclude: completed treatments, resolved problems, background history.',
    writingStyleOverride: 'Bullet-point style, action-oriented, brief.',
    additionalInstructionsOverride: `List what is unresolved, pending, or needs monitoring. 1-4 items maximum.\nExample: "Iron studies pending — exclude iron deficiency vs CKD-related anaemia. Cardiology referral placed — Holter requested for palpitations. Glycaemic control suboptimal — recheck HbA1c in 3 months."\nIf nothing is pending, write: "No outstanding items documented."\nDo not repeat information from Overview or Recent.`,
  },
];

async function cortiAuthenticate(clientId: string, clientSecret: string, tenant: string, region: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'openid',
  });
  const response = await fetch(`https://auth.${region}.corti.app/realms/${tenant}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`Corti auth failed: ${response.status}`);
  }
  const data = await response.json();
  return data.access_token as string;
}

/**
 * Public action: Build (or rebuild) the living patient profile.
 * Calls Corti directly — no dependency on SITE_URL or Next.js routes.
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
        { patientId: args.patientId, encounterId: args.encounterId }
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

      // Step 2: Authenticate with Corti directly
      const clientId = process.env.CORTI_CLIENT_ID;
      const clientSecret = process.env.CORTI_CLIENT_SECRET;
      const tenant = process.env.CORTI_TENANT?.trim();
      const region = process.env.CORTI_ENV || 'eu';

      if (!clientId || !clientSecret || !tenant) {
        return { success: false, error: 'Missing Corti credentials in Convex environment' };
      }

      const accessToken = await cortiAuthenticate(clientId, clientSecret, tenant, region);

      // Step 3: Aggregate facts from all encounters
      const facts: Array<{ text: string; source: 'core'; group: string }> = [];
      const { patientInfo, encounters } = contextData;

      if (patientInfo.name) facts.push({ text: `Patient: ${patientInfo.name}`, source: 'core', group: 'demographics' });
      if (patientInfo.age) facts.push({ text: `Age: ${patientInfo.age}`, source: 'core', group: 'demographics' });
      if (patientInfo.sex) facts.push({ text: `Sex: ${patientInfo.sex}`, source: 'core', group: 'demographics' });
      if (patientInfo.weight) facts.push({ text: `Weight: ${patientInfo.weight}`, source: 'core', group: 'demographics' });
      facts.push({
        text: `Allergies: ${(patientInfo.allergies ?? []).length > 0 ? patientInfo.allergies.join(', ') : 'none documented'}`,
        source: 'core',
        group: 'allergies',
      });

      for (const enc of encounters) {
        if (enc.date) facts.push({ text: `Encounter date: ${enc.date}`, source: 'core', group: 'history-of-present-illness' });
        if (enc.chiefComplaint) facts.push({ text: `Chief complaint: ${enc.chiefComplaint}`, source: 'core', group: 'chief-complaint' });
        if (enc.icd10Codes?.length > 0) facts.push({ text: `Diagnoses: ${enc.icd10Codes.join(', ')}`, source: 'core', group: 'assessment' });
        for (const [group, groupFacts] of Object.entries(enc.keyFacts ?? {})) {
          for (const fact of (groupFacts as string[]).slice(0, 8)) {
            facts.push({ text: fact, source: 'core', group });
          }
        }
        if (enc.planText) facts.push({ text: `Plan: ${enc.planText}`, source: 'core', group: 'plan' });
      }

      // Step 4: Create a fresh v1 interaction for document generation
      const interactionResponse = await fetch(
        `https://api.${region}.corti.app/interactions/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!interactionResponse.ok) {
        const errText = await interactionResponse.text();
        console.error('[PatientProfile] Interaction creation error:', errText.substring(0, 200));
        await ctx.runMutation(internal.patientProfiles.updateBuildStatus, {
          patientId: args.patientId,
          orgId: args.orgId,
          encounterId: args.encounterId,
          status: 'failed',
        });
        return { success: false, error: `Corti interaction error: ${interactionResponse.status}` };
      }
      const { id: interactionId } = await interactionResponse.json();

      // Step 5: Call Corti document generation directly
      const docResponse = await fetch(
        `https://api.${region}.corti.app/v2/interactions/${interactionId}/documents`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Tenant-Name': tenant,
          },
          body: JSON.stringify({
            context: [{ type: 'facts', data: facts }],
            template: { sections: PATIENT_PROFILE_SECTIONS },
            outputLanguage: 'en',
            name: patientInfo.name ? `Clinical Profile — ${patientInfo.name}` : 'Clinical Profile',
            documentationMode: 'routed_parallel',
          }),
        }
      );

      if (!docResponse.ok) {
        const errorText = await docResponse.text();
        console.error('[PatientProfile] Corti doc gen error:', errorText.substring(0, 300));
        await ctx.runMutation(internal.patientProfiles.updateBuildStatus, {
          patientId: args.patientId,
          orgId: args.orgId,
          encounterId: args.encounterId,
          status: 'failed',
        });
        return { success: false, error: `Corti error: ${docResponse.status}` };
      }

      const document = await docResponse.json();

      // Step 5: Map sections and save
      const summarySections = (document.sections ?? [])
        .map((s: { key: string; name?: string; title?: string; text?: string; content?: string }) => ({
          title: s.name || s.title || s.key,
          content: s.text || s.content || '',
        }))
        .filter((s: { title: string; content: string }) => s.content.trim().length > 0);

      const profile = {
        summarySections,
        activeProblems: [] as Array<{ condition: string; status: string; lastMentionedDate: string }>,
        currentMedications: [] as Array<{ drug: string }>,
        allergies: [] as Array<{ allergen: string }>,
        riskFactors: [] as string[],
        clinicalNarrative: '',
        careGaps: [] as Array<{ description: string; priority: string }>,
        keyHistory: '',
      };

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
  args: { patientId: v.id("patients"), encounterId: v.id("encounters") },
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
      summarySections: existingProfile.summarySections,
      careGaps: existingProfile.careGaps,
      keyHistory: existingProfile.keyHistory,
    } : null;

    // Find the most recent real Corti interactionId from published encounters.
    // Dictation encounters use synthetic IDs like "dictation-xxx" which aren't valid Corti interactions.
    const cortiFacts = rawEncounters.find(enc => enc.interactionId && !enc.interactionId.startsWith('dictation-'));
    const triggerInteractionId = cortiFacts?.interactionId ?? null;

    return { patientInfo, encounters, existingProfile: profileForAgent, triggerInteractionId };
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
      summarySections: v.optional(v.array(v.object({
        title: v.string(),
        content: v.string(),
      }))),
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
      summarySections: args.profile.summarySections ?? undefined,
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
