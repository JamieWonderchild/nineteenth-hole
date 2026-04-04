import { v } from "convex/values";
import { action, internalMutation, mutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Background action: Extract structured orders from the SOAP Plan section.
 * Triggered automatically after saveGeneratedDocuments saves a SOAP note.
 */
export const extractOrdersFromDocument = action({
  args: {
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; ordersExtracted?: number; message?: string; error?: string }> => {
    console.log(`[OrderOrchestration] Starting for encounter ${args.encounterId}`);

    try {
      // Step 1: Fetch plan text + patient info
      const data = await ctx.runMutation(
        internal.orderOrchestration.getPlanAndPatientData,
        { encounterId: args.encounterId }
      );

      if (!data) {
        console.log('[OrderOrchestration] No encounter found, skipping');
        await ctx.runMutation(internal.orderOrchestration.updateOrderExtractionStatus, {
          encounterId: args.encounterId, status: 'failed', error: 'Encounter not found',
        });
        return { success: false, error: 'Encounter not found' };
      }

      if (!data.planText || data.planText.trim().length < 10) {
        console.log('[OrderOrchestration] Plan section empty or too short, skipping');
        await ctx.runMutation(internal.orderOrchestration.updateOrderExtractionStatus, {
          encounterId: args.encounterId, status: 'completed',
        });
        return { success: true, ordersExtracted: 0, message: 'Plan section empty' };
      }

      // Step 2: Call Corti agent via API route
      const apiUrl = process.env.SITE_URL || 'https://healthplatform.com';
      const response = await fetch(`${apiUrl}/api/corti/extract-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planText: data.planText,
          patientInfo: data.patientInfo,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OrderOrchestration] API error:', errorText.substring(0, 300));
        await ctx.runMutation(internal.orderOrchestration.updateOrderExtractionStatus, {
          encounterId: args.encounterId, status: 'failed', error: `API error: ${response.status}`,
        });
        return { success: false, error: `API error: ${response.status}` };
      }

      const { extraction } = await response.json();

      if (!extraction || !Array.isArray(extraction.orders)) {
        await ctx.runMutation(internal.orderOrchestration.updateOrderExtractionStatus, {
          encounterId: args.encounterId, status: 'failed', error: 'Invalid extraction response',
        });
        return { success: false, error: 'Invalid extraction response' };
      }

      // Step 3: Save suggested orders
      await ctx.runMutation(internal.orderOrchestration.saveSuggestedOrders, {
        encounterId: args.encounterId,
        orders: extraction.orders,
        planSectionContent: data.planText,
      });

      console.log(`[OrderOrchestration] Extracted ${extraction.orders.length} orders`);
      return { success: true, ordersExtracted: extraction.orders.length };

    } catch (error) {
      console.error('[OrderOrchestration] Fatal error:', error);
      await ctx.runMutation(internal.orderOrchestration.updateOrderExtractionStatus, {
        encounterId: args.encounterId, status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});

/**
 * Internal: Fetch plan text and patient info for order extraction
 */
export const getPlanAndPatientData = internalMutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;

    const planSection = encounter.generatedDocuments?.soapNote?.sections?.find(
      (s: { key: string; content: string }) => s.key === 'corti-plan'
    );
    const planText = planSection?.content ?? '';

    let patientInfo: { name?: string; age?: string; sex?: string; weight?: string } = {};
    if (encounter.patientId) {
      const patient = await ctx.db.get(encounter.patientId);
      if (patient) {
        patientInfo = {
          name: patient.name,
          age: patient.age ?? undefined,
          sex: patient.sex ?? undefined,
          weight: patient.weight ?? undefined,
        };
      }
    }

    return { planText, patientInfo };
  },
});

/**
 * Internal: Save the extracted orders to the encounter
 */
export const saveSuggestedOrders = internalMutation({
  args: {
    encounterId: v.id("encounters"),
    orders: v.array(v.object({
      id: v.string(),
      type: v.string(),
      title: v.string(),
      detail: v.string(),
      sourceText: v.string(),
      confidence: v.string(),
    })),
    planSectionContent: v.string(),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();
    await ctx.db.patch(args.encounterId, {
      suggestedOrders: {
        orders: args.orders.map(o => ({
          id: o.id,
          type: o.type,
          title: o.title,
          detail: o.detail,
          sourceText: o.sourceText,
          accepted: undefined,
          acceptedAt: undefined,
        })),
        extractedAt: timestamp,
        extractedFromDocumentType: 'soapNote',
        planSectionContent: args.planSectionContent,
      },
      orderExtractionStatus: 'completed',
      updatedAt: timestamp,
    });
  },
});

/**
 * Internal: Update order extraction status
 */
export const updateOrderExtractionStatus = internalMutation({
  args: {
    encounterId: v.id("encounters"),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.encounterId, {
      orderExtractionStatus: args.status,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Public: Reset order extraction status to 'processing' and re-run.
 * Used by the manual re-run button in OrderSuggestionsPanel.
 */
export const rerunExtraction = mutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.encounterId, {
      orderExtractionStatus: 'processing',
      updatedAt: new Date().toISOString(),
    });
    await ctx.scheduler.runAfter(0, api.orderOrchestration.extractOrdersFromDocument, {
      encounterId: args.encounterId,
    });
  },
});

/**
 * Accept a single suggested order
 */
export const acceptOrder = mutation({
  args: {
    encounterId: v.id("encounters"),
    orderId: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter?.suggestedOrders) return;

    const timestamp = new Date().toISOString();
    const updatedOrders = encounter.suggestedOrders.orders.map(o =>
      o.id === args.orderId ? { ...o, accepted: true, acceptedAt: timestamp } : o
    );

    await ctx.db.patch(args.encounterId, {
      suggestedOrders: { ...encounter.suggestedOrders, orders: updatedOrders },
      updatedAt: timestamp,
    });
  },
});

/**
 * Dismiss a single suggested order
 */
export const dismissOrder = mutation({
  args: {
    encounterId: v.id("encounters"),
    orderId: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter?.suggestedOrders) return;

    const timestamp = new Date().toISOString();
    const updatedOrders = encounter.suggestedOrders.orders.map(o =>
      o.id === args.orderId ? { ...o, accepted: false, acceptedAt: timestamp } : o
    );

    await ctx.db.patch(args.encounterId, {
      suggestedOrders: { ...encounter.suggestedOrders, orders: updatedOrders },
      updatedAt: timestamp,
    });
  },
});

/**
 * Accept all pending suggested orders at once
 */
export const acceptAllOrders = mutation({
  args: {
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter?.suggestedOrders) return;

    const timestamp = new Date().toISOString();
    const updatedOrders = encounter.suggestedOrders.orders.map(o =>
      o.accepted === undefined ? { ...o, accepted: true, acceptedAt: timestamp } : o
    );

    await ctx.db.patch(args.encounterId, {
      suggestedOrders: { ...encounter.suggestedOrders, orders: updatedOrders },
      updatedAt: timestamp,
    });
  },
});
