import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePatientAccess } from "./permissions";
import type { Id } from "./_generated/dataModel";

export const createPatient = mutation({
  args: {
    name: v.string(),
    mrn: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    age: v.optional(v.string()),
    sex: v.optional(v.string()),
    insurance: v.optional(v.object({
      provider: v.string(),
      memberId: v.optional(v.string()),
      groupId: v.optional(v.string()),
    })),
    emergencyContact: v.optional(v.object({
      name: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      relationship: v.optional(v.string()),
    })),
    allergies: v.optional(v.array(v.string())),
    primaryCareProvider: v.optional(v.string()),
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    // Permission check: require active membership with patient access
    if (args.orgId) {
      await requirePatientAccess(ctx, args.providerId, args.orgId);
    }

    // Auto-create provider record if it doesn't exist (for new members)
    let provider = await ctx.db
      .query("providers")
      .filter((q) => q.eq(q.field("userId"), args.providerId))
      .first();

    if (!provider && args.orgId) {
      const providerId = await ctx.db.insert("providers", {
        userId: args.providerId,
        name: "Provider User",
        email: "",
        orgId: args.orgId,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      provider = await ctx.db.get(providerId);
    }

    if (!provider) {
      throw new Error("Unable to create or find provider record");
    }

    const patientId = await ctx.db.insert("patients", {
      name: args.name,
      mrn: args.mrn,
      dateOfBirth: args.dateOfBirth,
      age: args.age,
      sex: args.sex,
      insurance: args.insurance,
      emergencyContact: args.emergencyContact,
      allergies: args.allergies,
      primaryCareProvider: args.primaryCareProvider,
      providerId: args.providerId,
      orgId: args.orgId,
      locationId: args.locationId,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      medicalHistory: [],
    });

    await ctx.runMutation(internal.auditLogs.log, {
      orgId: args.orgId,
      userId: args.providerId,
      action: 'create',
      resourceType: 'patient',
      resourceId: patientId,
    });

    return patientId;
  },
});

export const getPatientsByVet = query({
  args: { providerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .filter((q) => q.eq(q.field("providerId"), args.providerId))
      .collect();
  },
});

export const getPatientsByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getPatientById = query({
  args: { id: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const updatePatient = mutation({
  args: {
    patientId: v.id("patients"),
    name: v.optional(v.string()),
    mrn: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    age: v.optional(v.string()),
    sex: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
    primaryCareProvider: v.optional(v.string()),
    insurance: v.optional(v.object({
      provider: v.string(),
      memberId: v.optional(v.string()),
      groupId: v.optional(v.string()),
    })),
    emergencyContact: v.optional(v.object({
      name: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      relationship: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    const { patientId, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    return await ctx.db.patch(patientId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Find patient by name (fuzzy match)
export const findPatient = query({
  args: {
    providerId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const patients = await ctx.db
      .query("patients")
      .filter((q) => q.eq(q.field("providerId"), args.providerId))
      .collect();

    const nameLower = args.name.toLowerCase();
    return patients.find(p => p.name.toLowerCase() === nameLower) || null;
  },
});

// Find or create patient from form-filling agent output
export const findOrCreatePatient = mutation({
  args: {
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")),
    name: v.string(),
    age: v.optional(v.string()),
    weight: v.optional(v.string()),
    weightUnit: v.optional(v.string()),
    sex: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const timestamp = new Date().toISOString();

      console.log("findOrCreatePatient called with:", {
        providerId: args.providerId,
        orgId: args.orgId,
        name: args.name,
      });

      // Verify provider exists, create if missing
      let provider = await ctx.db
        .query("providers")
        .filter((q) => q.eq(q.field("userId"), args.providerId))
        .first();

      if (!provider) {
        console.log("Creating provider record for user:", args.providerId);
        const providerOrgId = args.orgId;
        if (!providerOrgId) {
          throw new Error(`Cannot create provider record without orgId for userId: ${args.providerId}`);
        }
        const providerId = await ctx.db.insert("providers", {
          userId: args.providerId,
          name: "Provider User",
          email: "provider@example.com",
          orgId: providerOrgId,
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        provider = await ctx.db.get(providerId);
        if (!provider) {
          throw new Error("Failed to create provider record");
        }
      }

      // Try to find existing patient by name
      const patients = await ctx.db
        .query("patients")
        .filter((q) => q.eq(q.field("providerId"), args.providerId))
        .collect();

      const nameLower = args.name.toLowerCase();
      const existing = patients.find(p => p.name.toLowerCase() === nameLower);

      if (existing) {
        const updates: Record<string, unknown> = { updatedAt: timestamp };
        if (args.age) updates.age = args.age;
        if (args.sex) updates.sex = args.sex;
        await ctx.db.patch(existing._id, updates);
        return { patientId: existing._id, created: false };
      }

      // Calculate DOB from age if provided
      let dateOfBirth: string | undefined;
      if (args.age) {
        const ageMatch = args.age.match(/(\d+(?:\.\d+)?)\s*(year|month|week|day)/i);
        if (ageMatch) {
          const value = parseFloat(ageMatch[1]);
          const unit = ageMatch[2].toLowerCase();
          const now = new Date();
          if (unit.startsWith('year')) {
            now.setFullYear(now.getFullYear() - Math.floor(value));
          } else if (unit.startsWith('month')) {
            now.setMonth(now.getMonth() - Math.floor(value));
          } else if (unit.startsWith('week')) {
            now.setDate(now.getDate() - Math.floor(value * 7));
          } else if (unit.startsWith('day')) {
            now.setDate(now.getDate() - Math.floor(value));
          }
          dateOfBirth = now.toISOString().split('T')[0];
        }
      }

      // Create new patient
      const patientData: Record<string, unknown> = {
        name: args.name,
        age: args.age,
        dateOfBirth,
        sex: args.sex,
        providerId: args.providerId,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        medicalHistory: [],
      };

      if (args.orgId) {
        patientData.orgId = args.orgId;
      } else if (provider.orgId) {
        patientData.orgId = provider.orgId;
      }

      console.log("Inserting patient:", { name: patientData.name, orgId: patientData.orgId });
      const patientId = await ctx.db.insert("patients", patientData as Parameters<typeof ctx.db.insert<"patients">>[1]);
      console.log("Patient created:", patientId);

      return { patientId, created: true };
    } catch (error) {
      console.error("findOrCreatePatient error:", error);
      throw error;
    }
  },
});
