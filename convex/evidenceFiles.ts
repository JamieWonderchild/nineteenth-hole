// convex/evidenceFiles.ts
// CRUD for evidence files (lab PDFs, imaging, referral letters) with Convex file storage.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate an upload URL for Convex storage
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Create an evidence file record after upload
export const createEvidenceFile = mutation({
  args: {
    encounterId: v.id("encounters"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    category: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    return await ctx.db.insert("evidenceFiles", {
      encounterId: args.encounterId,
      storageId: args.storageId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      category: args.category,
      extractionStatus: "pending",
      uploadedBy: args.uploadedBy,
      createdAt: new Date().toISOString(),
    });
  },
});

// Get all evidence files for a encounter
export const getByConsultation = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("evidenceFiles")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    // Add file URLs
    const withUrls = await Promise.all(
      files.map(async (f) => {
        const url = await ctx.storage.getUrl(f.storageId);
        return { ...f, url };
      })
    );

    return withUrls.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  },
});

// Update extraction results
export const updateExtraction = mutation({
  args: {
    id: v.id("evidenceFiles"),
    extractedFindings: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      group: v.string(),
      confidence: v.optional(v.number()),
    }))),
    extractionStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (!file) throw new Error("Evidence file not found");

    await ctx.db.patch(args.id, {
      extractedFindings: args.extractedFindings,
      extractionStatus: args.extractionStatus,
    });

    return { success: true };
  },
});

// Update manual notes for an evidence file
export const updateNotes = mutation({
  args: {
    id: v.id("evidenceFiles"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (!file) throw new Error("Evidence file not found");

    await ctx.db.patch(args.id, { notes: args.notes });
    return { success: true };
  },
});

// Delete an evidence file (removes from storage + DB)
export const deleteEvidenceFile = mutation({
  args: { id: v.id("evidenceFiles") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (!file) throw new Error("Evidence file not found");

    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(args.id);

    return { success: true };
  },
});

// Get a file URL by storageId
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
