import { v } from "convex/values";
import { action, internalMutation, mutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Background action: Extract billing items from a recording's facts
 * Triggered automatically after recording save
 */
export const extractFromRecording = action({
  args: {
    encounterId: v.id("encounters"),
    recordingId: v.id("recordings"),
    orgId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; itemsCreated?: number; message?: string; error?: string; summary?: any }> => {
    console.log(`[BillingExtraction] ========================================`);
    console.log(`[BillingExtraction] Starting for recording ${args.recordingId}`);
    console.log(`[BillingExtraction] Encounter: ${args.encounterId}`);
    console.log(`[BillingExtraction] OrgId: ${args.orgId}`);
    console.log(`[BillingExtraction] UserId: ${args.userId}`);

    try {
      // Step 1: Fetch encounter data (facts from all recordings)
      console.log('[BillingExtraction] Step 1: Fetching encounter data...');
      const consultationData: { facts: Array<{ id: string; text: string; group: string }> } = await ctx.runMutation(
        internal.billingExtraction.getConsultationData,
        { encounterId: args.encounterId }
      );

      console.log(`[BillingExtraction] Fetched ${consultationData?.facts?.length || 0} facts`);
      if (consultationData?.facts) {
        consultationData.facts.forEach((fact, idx) => {
          console.log(`[BillingExtraction]   Fact ${idx + 1}: [${fact.group}] ${fact.text.substring(0, 60)}...`);
        });
      }

      if (!consultationData || consultationData.facts.length === 0) {
        console.log('[BillingExtraction] ❌ No facts to process, skipping');
        await ctx.runMutation(internal.billingExtraction.updateExtractionStatus, {
          recordingId: args.recordingId,
          status: 'completed',
          itemsExtracted: 0,
        });
        return { success: true, itemsCreated: 0, message: 'No facts to process' };
      }

      // Step 2: Fetch billing catalog
      console.log('[BillingExtraction] Step 2: Fetching billing catalog...');
      const catalog: Array<{ _id: string; name: string; code: string; category: string; basePrice: number; taxable: boolean }> = await ctx.runMutation(
        internal.billingExtraction.getCatalogData,
        { orgId: args.orgId }
      );

      console.log(`[BillingExtraction] Fetched ${catalog.length} catalog items`);
      if (catalog.length > 0) {
        catalog.forEach((item, idx) => {
          console.log(`[BillingExtraction]   Catalog ${idx + 1}: [${item.category}] ${item.name} ($${(item.basePrice / 100).toFixed(2)})`);
        });
      }

      if (catalog.length === 0) {
        console.log('[BillingExtraction] ❌ No catalog items available, skipping');
        await ctx.runMutation(internal.billingExtraction.updateExtractionStatus, {
          recordingId: args.recordingId,
          status: 'completed',
          itemsExtracted: 0,
        });
        return { success: true, itemsCreated: 0, message: 'No catalog items' };
      }

      // Step 3: Fetch existing items for deduplication
      console.log('[BillingExtraction] Step 3: Fetching existing items...');
      const existingItems: Array<{ factId: string; description: string }> = await ctx.runMutation(
        internal.billingExtraction.getExistingItems,
        { encounterId: args.encounterId }
      );

      console.log(`[BillingExtraction] Found ${existingItems.length} existing items`);
      if (existingItems.length > 0) {
        existingItems.forEach((item, idx) => {
          console.log(`[BillingExtraction]   Existing ${idx + 1}: Fact ${item.factId} - ${item.description}`);
        });
      }

      // Step 4: Call Corti agent via API route
      console.log('[BillingExtraction] Step 4: Calling Corti agent API...');
      const apiUrl = process.env.SITE_URL || 'https://[PRODUCT_NAME_DOMAIN]';
      console.log(`[BillingExtraction] API URL: ${apiUrl}/api/corti/extract-billing`);
      const response = await fetch(`${apiUrl}/api/corti/extract-billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facts: consultationData.facts,
          catalog: catalog,
          existingItems: existingItems,
        }),
      });

      console.log(`[BillingExtraction] API Response status: ${response.status}`);
      const contentType = response.headers.get('content-type');
      console.log(`[BillingExtraction] API Response content-type: ${contentType}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BillingExtraction] ❌ API error response:', errorText.substring(0, 500));
        await ctx.runMutation(internal.billingExtraction.updateExtractionStatus, {
          recordingId: args.recordingId,
          status: 'failed',
          error: `API request failed: ${response.status}`,
        });
        return { success: false, error: `API request failed: ${response.status}` };
      }

      const responseText = await response.text();
      console.log(`[BillingExtraction] Raw API response (first 300 chars):`, responseText.substring(0, 300));

      let extraction;
      try {
        const parsed = JSON.parse(responseText);
        extraction = parsed.extraction;
      } catch (parseError) {
        console.error('[BillingExtraction] ❌ JSON parse error:', parseError instanceof Error ? parseError.message : parseError);
        console.error('[BillingExtraction] Full response:', responseText);
        throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      console.log(`[BillingExtraction] ✅ API call successful`);
      console.log(`[BillingExtraction] Extraction summary:`, JSON.stringify(extraction.summary));
      console.log(`[BillingExtraction] Extracted ${extraction.extractedItems?.length || 0} items`);
      if (extraction.extractedItems && extraction.extractedItems.length > 0) {
        extraction.extractedItems.forEach((item: any, idx: number) => {
          console.log(`[BillingExtraction]   Item ${idx + 1}: ${item.description} (${item.confidence}) - Fact ${item.factId}`);
        });
      }
      if (extraction.unmatchedFacts && extraction.unmatchedFacts.length > 0) {
        console.log(`[BillingExtraction] Unmatched facts: ${extraction.unmatchedFacts.join(', ')}`);
      }

      // Step 5: Create billing items
      console.log('[BillingExtraction] Step 5: Creating billing items...');
      const itemsCreated = await ctx.runMutation(
        internal.billingExtraction.createExtractedItems,
        {
          encounterId: args.encounterId,
          orgId: args.orgId,
          userId: args.userId,
          extractedItems: extraction.extractedItems,
        }
      );

      console.log(`[BillingExtraction] Created ${itemsCreated} billing items in database`);

      // Step 6: Update extraction status
      console.log('[BillingExtraction] Step 6: Updating extraction status...');
      await ctx.runMutation(internal.billingExtraction.updateExtractionStatus, {
        recordingId: args.recordingId,
        status: 'completed',
        itemsExtracted: itemsCreated,
      });

      console.log(`[BillingExtraction] ✅ COMPLETED: ${itemsCreated} items created`);
      console.log(`[BillingExtraction] ========================================`);
      return {
        success: true,
        itemsCreated,
        summary: extraction.summary,
      };
    } catch (error) {
      console.error('[BillingExtraction] ❌ FATAL ERROR:', error);
      console.error('[BillingExtraction] Error details:', error instanceof Error ? error.stack : String(error));
      await ctx.runMutation(internal.billingExtraction.updateExtractionStatus, {
        recordingId: args.recordingId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.log(`[BillingExtraction] ========================================`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Internal mutation: Fetch encounter facts
 */
export const getConsultationData = internalMutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const facts: Array<{ id: string; text: string; group: string }> = [];

    for (const recording of recordings) {
      if (recording.facts && Array.isArray(recording.facts)) {
        for (const fact of recording.facts) {
          facts.push({
            id: fact.id,
            text: fact.text,
            group: fact.group || 'general',
          });
        }
      }
    }

    return { facts };
  },
});

/**
 * Internal mutation: Fetch billing catalog
 */
export const getCatalogData = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const catalogItems = await ctx.db
      .query("billingCatalog")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return catalogItems.map(item => ({
      _id: item._id,
      name: item.name,
      code: item.code,
      category: item.category,
      basePrice: item.basePrice,
      taxable: item.taxable ?? false,
    }));
  },
});

/**
 * Internal mutation: Fetch existing extracted items
 */
export const getExistingItems = internalMutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("billingItems")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .filter((q) => q.neq(q.field("extractedFromFact"), undefined))
      .collect();

    return items.map(item => ({
      factId: item.extractedFromFact!,
      description: item.description,
    }));
  },
});

/**
 * Internal mutation: Create billing items from extraction results
 */
export const createExtractedItems = internalMutation({
  args: {
    encounterId: v.id("encounters"),
    orgId: v.id("organizations"),
    userId: v.string(),
    extractedItems: v.array(
      v.object({
        factId: v.string(),
        catalogItemId: v.string(),
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        taxable: v.boolean(),
        confidence: v.string(),
        reasoning: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let itemsCreated = 0;
    const timestamp = new Date().toISOString();

    for (const item of args.extractedItems) {
      await ctx.db.insert("billingItems", {
        encounterId: args.encounterId,
        orgId: args.orgId,
        catalogItemId: item.catalogItemId as Id<"billingCatalog">,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxable: item.taxable,
        phase: "prospective", // Background extraction is prospective (before finalization)
        manuallyAdded: false,
        extractedFromFact: item.factId,
        confidence: item.confidence,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      itemsCreated++;
    }

    return itemsCreated;
  },
});

/**
 * Public mutation: Re-trigger billing extraction for a failed/missed recording
 */
export const retriggerExtraction = mutation({
  args: {
    recordingId: v.id("recordings"),
  },
  handler: async (ctx, args) => {
    const recording = await ctx.db.get(args.recordingId);
    if (!recording) throw new Error("Recording not found");

    const encounter = await ctx.db.get(recording.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    // Delete any previously auto-extracted items for this encounter so they don't block re-extraction
    const existingItems = await ctx.db
      .query("billingItems")
      .withIndex("by_encounter", (q) => q.eq("encounterId", recording.encounterId))
      .filter((q) => q.eq(q.field("manuallyAdded"), false))
      .collect();
    for (const item of existingItems) {
      await ctx.db.delete(item._id);
    }

    // Reset status to allow re-extraction
    await ctx.db.patch(args.recordingId, {
      billingExtractionStatus: "processing" as const,
      billingExtractionError: undefined,
      billingItemsExtracted: undefined,
      billingExtractionAt: undefined,
    });

    if (!encounter.orgId) throw new Error("Encounter has no orgId");

    await ctx.scheduler.runAfter(0, api.billingExtraction.extractFromRecording, {
      encounterId: recording.encounterId,
      recordingId: args.recordingId,
      orgId: encounter.orgId,
      userId: encounter.providerId,
    });

    return { triggered: true };
  },
});

/**
 * Internal mutation: Update recording extraction status
 */
export const updateExtractionStatus = internalMutation({
  args: {
    recordingId: v.id("recordings"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    itemsExtracted: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recordingId, {
      billingExtractionStatus: args.status,
      billingExtractionAt: Date.now(),
      billingItemsExtracted: args.itemsExtracted,
      billingExtractionError: args.error,
    });
  },
});

/**
 * Background action: Extract billing items from a dictated note (addendum)
 * Triggered automatically after addAddendum saves a note.
 * Converts note markdown lines into synthetic facts and runs them through
 * the same billing extraction pipeline used for recordings.
 */
export const extractFromNote = action({
  args: {
    encounterId: v.id("encounters"),
    orgId: v.id("organizations"),
    userId: v.string(),
    noteText: v.string(),
    noteIndex: v.number(), // position in addenda array, used for dedup key
  },
  handler: async (ctx, args): Promise<{ success: boolean; itemsCreated?: number; error?: string }> => {
    try {
      // Convert markdown note into synthetic facts (one per non-empty line)
      const facts = args.noteText
        .split('\n')
        .map((line, i) => ({
          id: `note-${args.noteIndex}-${i}`,
          // Strip markdown list markers (-, *, 1., 2., etc.)
          text: line.replace(/^[\s]*[-*\d.]+\s+/, '').trim(),
          group: 'plan',
        }))
        .filter(f => f.text.length > 4);

      if (facts.length === 0) return { success: true, itemsCreated: 0 };

      const catalog: Array<{ _id: string; name: string; code: string; category: string; basePrice: number; taxable: boolean }> = await ctx.runMutation(
        internal.billingExtraction.getCatalogData,
        { orgId: args.orgId }
      );
      if (catalog.length === 0) return { success: true, itemsCreated: 0 };

      const existingItems: Array<{ factId: string; description: string }> = await ctx.runMutation(
        internal.billingExtraction.getExistingItems,
        { encounterId: args.encounterId }
      );

      const apiUrl = process.env.SITE_URL || 'https://health-platform.vercel.app';
      const response = await fetch(`${apiUrl}/api/corti/extract-billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts, catalog, existingItems }),
      });

      if (!response.ok) return { success: false, error: `API error: ${response.status}` };

      const { extraction } = await response.json();

      const itemsCreated: number = await ctx.runMutation(
        internal.billingExtraction.createExtractedItems,
        {
          encounterId: args.encounterId,
          orgId: args.orgId,
          userId: args.userId,
          extractedItems: extraction.extractedItems,
        }
      );

      return { success: true, itemsCreated };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});
