"use client";

import { CheckCircle, MinusCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TaxSettings {
  enabled: boolean;
  rate: number;
  name: string;
  currency: string;
  includedInPrices: boolean;
}

interface TaxSummaryBadgeProps {
  taxSettings?: TaxSettings;
  showTooltip?: boolean;
  className?: string;
}

/**
 * TaxSummaryBadge - Displays current tax configuration
 *
 * Shows:
 * - Whether tax is enabled/disabled
 * - Tax rate and name (e.g., "VAT 20%")
 * - Whether tax is included in prices or added on top
 *
 * Optional tooltip provides detailed explanation of tax calculation.
 */
export function TaxSummaryBadge({
  taxSettings,
  showTooltip = true,
  className = "",
}: TaxSummaryBadgeProps) {
  if (!taxSettings?.enabled) {
    const badge = (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium ${className}`}
      >
        <MinusCircle className="h-3 w-3" />
        No tax applied
      </div>
    );

    if (!showTooltip) return badge;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Tax is disabled for this organization.
              <br />
              Configure in Billing Preferences.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const taxModeLabel = taxSettings.includedInPrices ? "included" : "added";
  const taxModeExplanation = taxSettings.includedInPrices
    ? "Catalog prices already include tax. The tax amount is shown for information only."
    : "Tax is calculated and added to the subtotal at checkout.";

  const badge = (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium ${className}`}
    >
      <CheckCircle className="h-3 w-3" />
      {taxSettings.name} {taxSettings.rate}% ({taxModeLabel})
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-semibold mb-1">
                  {taxSettings.name} at {taxSettings.rate}%
                </p>
                <p className="text-muted-foreground">{taxModeExplanation}</p>
              </div>
            </div>
            {taxSettings.includedInPrices && (
              <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                Example: $100 catalog price = ${(100 * (100 / (100 + taxSettings.rate))).toFixed(2)} + $
                {(100 * (taxSettings.rate / (100 + taxSettings.rate))).toFixed(2)} tax
              </div>
            )}
            {!taxSettings.includedInPrices && (
              <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                Example: $100 catalog price + ${(100 * (taxSettings.rate / 100)).toFixed(2)} tax = $
                {(100 + 100 * (taxSettings.rate / 100)).toFixed(2)} total
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
