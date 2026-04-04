# Billing System

## Overview

Two-phase billing that automatically extracts billable items from encounter recordings and helps providers catch missed charges.

**Core value prop:** Provider records encounter → system extracts what was planned and what was done → flags anything that was done but not billed → provider reviews and generates invoice.

---

## Two-Phase Model

### Phase 1: Prospective (During Encounter)
Items the provider plans to do:
- Extracted from recording keywords: *"I'm going to...", "We need to...", "Let's run..."*
- Stored as `billingItems` with `phase: 'prospective'`
- Shown in UI as "Planned Services"

### Phase 2: Retrospective (After Encounter)
Items actually completed:
- Extracted from post-encounter dictation: *"I completed...", "I performed...", "Patient received..."*
- Stored as `billingItems` with `phase: 'retrospective'`
- Reconciled against prospective items to find gaps

---

## Background Extraction

When a recording is saved:
1. Background job triggers `POST /api/corti/extract-billing`
2. Corti agent matches facts against `billingCatalog` items
3. Creates `billingItems` records with `phase: 'prospective'`
4. `billingExtractionStatus` on the recording tracks progress: `'processing'` | `'completed'` | `'failed'`
5. UI updates in real-time via Convex

---

## Billing Catalog

Org's master price list — managed at `/billing?tab=catalog`.

```typescript
billingCatalog: {
  orgId, name, code, category, basePrice, taxable, isActive
}
```

Categories: `'exam'` | `'procedure'` | `'lab'` | `'medication'` | `'supply'` | `'imaging'` | `'hospitalization'` | `'other'`

Prices stored in **cents** (4500 = $45.00).

Soft-deleted with `isActive: false` — historical items on invoices are preserved.

---

## Catalog Matching

Corti agent fuzzy-matches extracted facts to catalog items using similarity scoring.

Each `billingItems` record includes:
- `catalogItemId` — matched catalog item (null for manual items)
- `confidence` — `'high'` | `'medium'` | `'low'`
- `extractedFromFact` — which Corti fact triggered this item

---

## Reconciliation

After retrospective extraction, `billingItems` are reconciled:

| Status | Meaning |
|--------|---------|
| `confirmed` | Planned and done — matched prospective ↔ retrospective |
| `added` | Done but not planned → **missed billing opportunity** |
| `cancelled` | Planned but not done → remove from invoice |
| `modified` | Quantity or details changed |

`linkedItemId` links prospective to retrospective counterpart.

Revenue recovery: sum of `added` items = money that would have been missed.

---

## Invoice Generation

`POST /api/corti/generate-invoice`

Uses Corti document generation with section overrides to produce a formatted invoice document.

Invoice metadata stored in `encounters.invoiceMetadata`:
```typescript
{
  invoiceNumber: "INV-202603-0042",
  invoiceDate: string,
  lineItems: [{ billingItemId, description, quantity, unitPrice, taxable, total }],
  subtotal, taxAmount, taxRate, grandTotal,
  revenueRecoveryPrompts: [{ itemDescription, action: 'skipped' | 'added' }],
  status: 'draft' | 'finalized',
  finalizedAt?: string,
}
```

Invoice also stored as a generated document in `encounters.generatedDocuments.invoice`.

---

## Tax Calculation

Configured per org (see [multi-org.md](../architecture/multi-org.md)).

```
Tax-exclusive (US/CA):
  taxAmount = taxableSubtotal * (rate / 100)
  total = subtotal + taxAmount

Tax-inclusive (EU/UK/AU):
  taxAmount = taxableSubtotal * (rate / (100 + rate))
  total = subtotal (unchanged)
```

---

## Settings

| Page | Purpose |
|------|---------|
| `/billing?tab=catalog` | Manage price list (add/edit/archive items) |
| `/settings/billing` | Tax settings, billing currency |

---

## Current Status (March 2026)

- ✅ Phase 0: Catalog CRUD, schema, UI shell
- ✅ Phase 1 foundation: `billingItems` table, extraction API route
- 🚧 Background extraction: In progress — Corti agent matching facts to catalog
- ⬜ Reconciliation UI: Not started
- ⬜ Invoice generation: Not started
- ⬜ Revenue analytics dashboard: Not started

**Known issue (Phase 0 blocker):** Matcher filters for `fact.group.startsWith('billing-')` but Corti doesn't automatically assign this prefix — the extraction agent must explicitly set it.
