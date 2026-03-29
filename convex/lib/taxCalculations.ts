/**
 * Tax Calculation Utilities
 *
 * This module provides utilities for calculating taxes in two modes:
 * 1. Tax-Exclusive: Tax is added on top of catalog prices
 * 2. Tax-Inclusive: Tax is already included in catalog prices
 *
 * All monetary values are in cents (e.g., 10000 = $100.00)
 */

export interface TaxSettings {
  enabled: boolean;
  rate: number; // Percentage (e.g., 20 = 20%)
  name: string; // "VAT", "Sales Tax", "GST"
  currency: string;
  includedInPrices: boolean;
}

export interface TaxCalculationResult {
  subtotal: number; // Amount before tax (cents)
  taxAmount: number; // Tax amount (cents)
  total: number; // Final amount charged to client (cents)
  priceWithoutTax?: number; // Only for tax-inclusive mode (cents)
}

/**
 * Calculate tax for a billing item
 *
 * @param price - Item price in cents (from catalog.basePrice)
 * @param quantity - Number of items
 * @param taxSettings - Organization's tax configuration
 * @param itemTaxable - Whether this specific item is taxable
 * @returns Tax calculation breakdown
 *
 * @example Tax-Exclusive (US Sales Tax)
 * ```typescript
 * const result = calculateTax(10000, 1, {
 *   enabled: true,
 *   rate: 8.5,
 *   name: "Sales Tax",
 *   currency: "USD",
 *   includedInPrices: false
 * }, true);
 * // Result:
 * // subtotal: 10000 ($100.00)
 * // taxAmount: 850 ($8.50)
 * // total: 10850 ($108.50)
 * ```
 *
 * @example Tax-Inclusive (UK VAT)
 * ```typescript
 * const result = calculateTax(10000, 1, {
 *   enabled: true,
 *   rate: 20,
 *   name: "VAT",
 *   currency: "GBP",
 *   includedInPrices: true
 * }, true);
 * // Result:
 * // subtotal: 10000 ($100.00)
 * // priceWithoutTax: 8333 ($83.33)
 * // taxAmount: 1667 ($16.67)
 * // total: 10000 ($100.00) - same as subtotal
 * ```
 */
export function calculateTax(
  price: number,
  quantity: number,
  taxSettings: TaxSettings | undefined,
  itemTaxable: boolean
): TaxCalculationResult {
  const subtotal = price * quantity;

  // No tax if disabled or item not taxable
  if (!taxSettings?.enabled || !itemTaxable) {
    return {
      subtotal,
      taxAmount: 0,
      total: subtotal,
    };
  }

  const rate = taxSettings.rate;

  if (taxSettings.includedInPrices) {
    // TAX-INCLUSIVE MODE (VAT, GST)
    // The catalog price ALREADY includes tax
    // We extract the tax amount for display purposes only
    //
    // Formula: taxAmount = price × (rate ÷ (100 + rate))
    //
    // Example: $120 with 20% VAT
    // taxAmount = 120 × (20 ÷ 120) = 120 × 0.1667 = $20
    // priceWithoutTax = 120 - 20 = $100
    // total = $120 (unchanged)
    const taxAmount = Math.round(subtotal * (rate / (100 + rate)));
    const priceWithoutTax = subtotal - taxAmount;

    return {
      subtotal,
      taxAmount,
      total: subtotal, // Price already includes tax
      priceWithoutTax,
    };
  } else {
    // TAX-EXCLUSIVE MODE (US Sales Tax, Canadian GST/PST)
    // Tax is ADDED on top of the catalog price
    //
    // Formula: taxAmount = price × (rate ÷ 100)
    //
    // Example: $100 with 8.5% Sales Tax
    // taxAmount = 100 × 0.085 = $8.50
    // total = 100 + 8.50 = $108.50
    const taxAmount = Math.round(subtotal * (rate / 100));
    const total = subtotal + taxAmount;

    return {
      subtotal,
      taxAmount,
      total,
    };
  }
}

/**
 * Calculate total tax for multiple billing items
 *
 * @param items - Array of billing items with price, quantity, and taxable flag
 * @param taxSettings - Organization's tax configuration
 * @returns Aggregated tax calculation
 */
export function calculateInvoiceTax(
  items: Array<{ price: number; quantity: number; taxable: boolean }>,
  taxSettings: TaxSettings | undefined
): TaxCalculationResult {
  let totalSubtotal = 0;
  let totalTaxAmount = 0;
  let totalWithoutTax = 0;

  for (const item of items) {
    const itemCalc = calculateTax(
      item.price,
      item.quantity,
      taxSettings,
      item.taxable
    );

    totalSubtotal += itemCalc.subtotal;
    totalTaxAmount += itemCalc.taxAmount;

    if (itemCalc.priceWithoutTax !== undefined) {
      totalWithoutTax += itemCalc.priceWithoutTax;
    }
  }

  const result: TaxCalculationResult = {
    subtotal: totalSubtotal,
    taxAmount: totalTaxAmount,
    total: taxSettings?.includedInPrices
      ? totalSubtotal
      : totalSubtotal + totalTaxAmount,
  };

  if (taxSettings?.includedInPrices) {
    result.priceWithoutTax = totalWithoutTax;
  }

  return result;
}

/**
 * Format tax calculation for display
 *
 * @param calculation - Tax calculation result
 * @param currency - Currency code (e.g., "USD")
 * @returns Formatted strings for display
 */
export function formatTaxCalculation(
  calculation: TaxCalculationResult,
  currency: string = "USD"
) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });

  return {
    subtotal: formatter.format(calculation.subtotal / 100),
    taxAmount: formatter.format(calculation.taxAmount / 100),
    total: formatter.format(calculation.total / 100),
    priceWithoutTax: calculation.priceWithoutTax
      ? formatter.format(calculation.priceWithoutTax / 100)
      : undefined,
  };
}

/**
 * Validation: Ensure tax rate is reasonable
 */
export function validateTaxRate(rate: number): boolean {
  return rate >= 0 && rate <= 100;
}

/**
 * Common tax rates by region (for reference)
 */
export const COMMON_TAX_RATES = {
  // USA State Sales Tax (varies by state + local)
  "US-CA": { rate: 7.25, name: "California Sales Tax", inclusive: false },
  "US-NY": { rate: 4.0, name: "New York Sales Tax", inclusive: false },
  "US-TX": { rate: 6.25, name: "Texas Sales Tax", inclusive: false },

  // Canada GST + PST
  "CA-BC": { rate: 12.0, name: "GST + PST", inclusive: false }, // 5% + 7%
  "CA-ON": { rate: 13.0, name: "HST", inclusive: false },
  "CA-QC": { rate: 14.975, name: "GST + QST", inclusive: false }, // 5% + 9.975%

  // Europe VAT (inclusive)
  "EU-UK": { rate: 20.0, name: "VAT", inclusive: true },
  "EU-DE": { rate: 19.0, name: "VAT", inclusive: true },
  "EU-FR": { rate: 20.0, name: "VAT", inclusive: true },

  // Australia/NZ GST (inclusive)
  "AU": { rate: 10.0, name: "GST", inclusive: true },
  "NZ": { rate: 15.0, name: "GST", inclusive: true },

  // South Africa VAT (inclusive)
  "ZA": { rate: 15.0, name: "VAT", inclusive: true },
} as const;
