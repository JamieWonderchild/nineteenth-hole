import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Generate next invoice number for org
 * Format: INV-YYYYMM-####
 */
export const getNextInvoiceNumber = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    // Find all encounters with invoices for this org in this month
    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.neq(q.field("invoiceMetadata"), undefined))
      .collect();

    // Extract invoice numbers from this month
    let maxSequence = 0;
    for (const encounter of encounters) {
      const invoiceNum = encounter.invoiceMetadata?.invoiceNumber;
      if (invoiceNum?.startsWith(prefix)) {
        const seqStr = invoiceNum.substring(prefix.length);
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSequence) {
          maxSequence = seq;
        }
      }
    }

    const nextSequence = maxSequence + 1;
    return `${prefix}${String(nextSequence).padStart(4, '0')}`;
  }
});

/**
 * Get invoice metadata for a encounter
 */
export const getInvoiceMetadata = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }
    return encounter.invoiceMetadata;
  }
});

/**
 * Create draft invoice with metadata (no document yet)
 */
export const createDraftInvoice = mutation({
  args: {
    encounterId: v.id("encounters"),
    orgId: v.id("organizations"),
    selectedItemIds: v.array(v.id("billingItems")),
    revenueRecoveryPrompts: v.optional(v.array(v.object({
      itemDescription: v.string(),
      action: v.string(), // 'skipped' | 'added'
    }))),
    taxRate: v.optional(v.number()), // percentage, default 0
  },
  handler: async (ctx, args) => {
    const { encounterId, orgId, selectedItemIds, revenueRecoveryPrompts, taxRate = 0 } = args;

    // 1. Fetch selected billing items
    const items = await Promise.all(
      selectedItemIds.map(id => ctx.db.get(id))
    );

    // Filter out any null items
    const validItems = items.filter(item => item !== null) as Array<{
      _id: Id<"billingItems">;
      description: string;
      quantity: number;
      unitPrice: number;
      taxable: boolean;
    }>;

    if (validItems.length === 0) {
      throw new Error("No valid billing items selected");
    }

    // 2. Calculate totals
    let subtotal = 0;
    const lineItems = validItems.map(item => {
      const total = item.quantity * item.unitPrice;
      subtotal += total;
      return {
        billingItemId: item._id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxable: item.taxable,
        total,
      };
    });

    const taxableSubtotal = lineItems
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + item.total, 0);

    const taxAmount = Math.round(taxableSubtotal * (taxRate / 100));
    const grandTotal = subtotal + taxAmount;

    // 3. Get next invoice number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    // Find max sequence for this month
    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.neq(q.field("invoiceMetadata"), undefined))
      .collect();

    let maxSequence = 0;
    for (const encounter of encounters) {
      const invoiceNum = encounter.invoiceMetadata?.invoiceNumber;
      if (invoiceNum?.startsWith(prefix)) {
        const seqStr = invoiceNum.substring(prefix.length);
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSequence) {
          maxSequence = seq;
        }
      }
    }

    const invoiceNumber = `${prefix}${String(maxSequence + 1).padStart(4, '0')}`;
    const invoiceDate = now.toISOString();

    // 4. Create invoiceMetadata object
    const invoiceMetadata = {
      invoiceNumber,
      invoiceDate,
      lineItems,
      subtotal,
      taxAmount,
      taxRate,
      grandTotal,
      revenueRecoveryPrompts: revenueRecoveryPrompts || [],
      status: "draft" as const,
    };

    // 5. Patch encounter with invoiceMetadata
    await ctx.db.patch(encounterId, {
      invoiceMetadata,
    });

    // 6. Return invoice data for document generation
    return {
      invoiceNumber,
      invoiceDate,
      lineItems,
      subtotal,
      taxAmount,
      taxRate,
      grandTotal,
    };
  }
});

/**
 * Update line items in draft invoice (before finalization)
 */
export const updateDraftInvoiceItems = mutation({
  args: {
    encounterId: v.id("encounters"),
    selectedItemIds: v.array(v.id("billingItems")),
    taxRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { encounterId, selectedItemIds, taxRate } = args;

    const encounter = await ctx.db.get(encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    if (!encounter.invoiceMetadata) {
      throw new Error("No draft invoice found");
    }

    if (encounter.invoiceMetadata.status !== "draft") {
      throw new Error("Cannot update finalized invoice");
    }

    // Fetch selected billing items
    const items = await Promise.all(
      selectedItemIds.map(id => ctx.db.get(id))
    );

    const validItems = items.filter(item => item !== null) as Array<{
      _id: Id<"billingItems">;
      description: string;
      quantity: number;
      unitPrice: number;
      taxable: boolean;
    }>;

    // Recalculate totals
    let subtotal = 0;
    const lineItems = validItems.map(item => {
      const total = item.quantity * item.unitPrice;
      subtotal += total;
      return {
        billingItemId: item._id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxable: item.taxable,
        total,
      };
    });

    const usedTaxRate = taxRate ?? encounter.invoiceMetadata.taxRate;
    const taxableSubtotal = lineItems
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + item.total, 0);

    const taxAmount = Math.round(taxableSubtotal * (usedTaxRate / 100));
    const grandTotal = subtotal + taxAmount;

    // Update invoice metadata
    await ctx.db.patch(encounterId, {
      invoiceMetadata: {
        ...encounter.invoiceMetadata,
        lineItems,
        subtotal,
        taxAmount,
        taxRate: usedTaxRate,
        grandTotal,
      }
    });

    return {
      lineItems,
      subtotal,
      taxAmount,
      taxRate: usedTaxRate,
      grandTotal,
    };
  }
});

/**
 * Finalize invoice (add generated document)
 */
export const finalizeInvoice = mutation({
  args: {
    encounterId: v.id("encounters"),
    generatedDocument: v.object({
      sections: v.array(v.object({
        key: v.string(),
        title: v.string(),
        content: v.string(),
      })),
      generatedAt: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const { encounterId, generatedDocument } = args;

    const encounter = await ctx.db.get(encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    if (!encounter.invoiceMetadata) {
      throw new Error("No draft invoice found");
    }

    if (encounter.invoiceMetadata.status === "finalized") {
      throw new Error("Invoice already finalized");
    }

    const now = new Date().toISOString();

    // 1. Update encounter with generated document
    await ctx.db.patch(encounterId, {
      generatedDocuments: {
        ...encounter.generatedDocuments,
        invoice: {
          sections: generatedDocument.sections,
          generatedAt: generatedDocument.generatedAt,
          totalAmount: encounter.invoiceMetadata.grandTotal,
          taxAmount: encounter.invoiceMetadata.taxAmount,
          subtotal: encounter.invoiceMetadata.subtotal,
        }
      },
      invoiceMetadata: {
        ...encounter.invoiceMetadata,
        status: "finalized",
        finalizedAt: now,
      }
    });

    // 2. Update billing items: just mark as invoiced (keep phase as prospective for reconciliation)
    const lineItemIds = encounter.invoiceMetadata.lineItems.map(
      item => item.billingItemId
    );

    await Promise.all(
      lineItemIds.map(itemId =>
        ctx.db.patch(itemId, {
          invoicedAt: now,
          updatedAt: now,
          reconciliationStatus: "matched", // Mark as matched since they were planned AND billed
        })
      )
    );

    return {
      success: true,
      invoiceNumber: encounter.invoiceMetadata.invoiceNumber,
    };
  }
});

/**
 * Void a finalized invoice — clears metadata & generated doc, resets invoicedAt on items.
 * Billing items (prospective + retrospective) stay in DB so the wizard can reuse them.
 */
export const voidInvoice = mutation({
  args: {
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");
    if (!encounter.invoiceMetadata) throw new Error("No invoice found");

    const now = new Date().toISOString();

    // Reset invoicedAt on all billed items so they become selectable again
    const lineItemIds = encounter.invoiceMetadata.lineItems.map(i => i.billingItemId);
    await Promise.all(
      lineItemIds.map(itemId =>
        ctx.db.patch(itemId, {
          invoicedAt: undefined,
          reconciliationStatus: undefined,
          updatedAt: now,
        })
      )
    );

    // Clear invoice metadata and generated invoice document
    const updatedDocs = encounter.generatedDocuments
      ? { ...encounter.generatedDocuments, invoice: undefined }
      : undefined;

    await ctx.db.patch(args.encounterId, {
      invoiceMetadata: undefined,
      generatedDocuments: updatedDocs,
    });

    return { success: true };
  }
});

/**
 * Cancel draft invoice (delete metadata, don't touch billing items)
 */
export const cancelDraftInvoice = mutation({
  args: {
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    if (!encounter.invoiceMetadata) {
      throw new Error("No invoice found");
    }

    if (encounter.invoiceMetadata.status !== "draft") {
      throw new Error("Cannot cancel finalized invoice");
    }

    // Remove invoice metadata
    await ctx.db.patch(args.encounterId, {
      invoiceMetadata: undefined,
    });

    return { success: true };
  }
});
