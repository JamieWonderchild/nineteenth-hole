'use client';

import * as React from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { useUser } from '@clerk/nextjs';

export default function BillingPreferencesPage() {
  const { user } = useUser();
  const { orgContext, isLoading: orgLoading } = useOrgCtx();

  // Billing currency state
  const [billingCurrency, setBillingCurrency] = React.useState("USD");
  const [savingCurrency, setSavingCurrency] = React.useState(false);
  const [currencyError, setCurrencyError] = React.useState<string | null>(null);

  // Tax settings state
  const [taxEnabled, setTaxEnabled] = React.useState(false);
  const [taxRate, setTaxRate] = React.useState("");
  const [taxName, setTaxName] = React.useState("");
  const [taxCurrency, setTaxCurrency] = React.useState("USD");
  const [taxIncluded, setTaxIncluded] = React.useState(false);
  const [taxSettingsLoaded, setTaxSettingsLoaded] = React.useState(false);
  const [savingTax, setSavingTax] = React.useState(false);
  const [taxError, setTaxError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // Dirty state tracking
  const [originalCurrency, setOriginalCurrency] = React.useState<string | null>(null);
  const [originalTaxSettings, setOriginalTaxSettings] = React.useState<{
    enabled: boolean;
    rate: string;
    name: string;
    currency: string;
    included: boolean;
  } | null>(null);
  const [isCurrencyDirty, setIsCurrencyDirty] = React.useState(false);
  const [isTaxDirty, setIsTaxDirty] = React.useState(false);

  const updateBillingCurrency = useMutation(api.organizations.updateBillingCurrency);
  const updateTaxSettings = useMutation(api.organizations.updateTaxSettings);

  const organization = useQuery(
    api.organizations.getById,
    orgContext ? { id: orgContext.orgId as Id<"organizations"> } : "skip"
  );

  // Load billing currency and tax settings from organization
  React.useEffect(() => {
    if (organization && !taxSettingsLoaded) {
      // Load billing currency
      const orgCurrency = organization.billingCurrency || "USD";
      setBillingCurrency(orgCurrency);
      setOriginalCurrency(orgCurrency);

      // Load tax settings
      const orgTax = organization.taxSettings || {
        enabled: false,
        rate: 0,
        name: "Tax",
        currency: "USD",
        includedInPrices: false,
      };

      setTaxEnabled(orgTax.enabled);
      setTaxRate(orgTax.rate.toString());
      setTaxName(orgTax.name);
      setTaxCurrency(orgTax.currency);
      setTaxIncluded(orgTax.includedInPrices);

      setOriginalTaxSettings({
        enabled: orgTax.enabled,
        rate: orgTax.rate.toString(),
        name: orgTax.name,
        currency: orgTax.currency,
        included: orgTax.includedInPrices,
      });

      setTaxSettingsLoaded(true);
    }
  }, [organization, taxSettingsLoaded]);

  // Check for dirty state (values changed from original)
  React.useEffect(() => {
    if (originalCurrency !== null) {
      setIsCurrencyDirty(billingCurrency !== originalCurrency);
    }

    if (originalTaxSettings !== null) {
      const taxChanged =
        taxEnabled !== originalTaxSettings.enabled ||
        taxRate !== originalTaxSettings.rate ||
        taxName !== originalTaxSettings.name ||
        taxCurrency !== originalTaxSettings.currency ||
        taxIncluded !== originalTaxSettings.included;
      setIsTaxDirty(taxChanged);
    }
  }, [
    billingCurrency,
    taxEnabled,
    taxRate,
    taxName,
    taxCurrency,
    taxIncluded,
    originalCurrency,
    originalTaxSettings
  ]);

  const handleSaveBillingCurrency = async () => {
    if (!orgContext || !user) return;

    setCurrencyError(null);
    setSavingCurrency(true);

    try {
      await updateBillingCurrency({
        userId: user.id,
        orgId: orgContext.orgId as Id<"organizations">,
        currency: billingCurrency.toUpperCase(),
      });

      // Update original value after successful save
      setOriginalCurrency(billingCurrency.toUpperCase());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving billing currency:", err);
      setCurrencyError(err.message || "Failed to save billing currency");
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleSaveTaxSettings = async () => {
    if (!orgContext || !user) return;

    setTaxError(null);
    setSaveSuccess(false);
    setSavingTax(true);

    try {
      const rate = parseFloat(taxRate);
      if (taxEnabled && isNaN(rate)) {
        throw new Error("Tax rate must be a valid number");
      }

      await updateTaxSettings({
        userId: user.id,
        orgId: orgContext.orgId as Id<"organizations">,
        enabled: taxEnabled,
        rate: taxEnabled ? rate : 0,
        name: taxName.trim() || "Tax",
        currency: taxCurrency.toUpperCase(),
        includedInPrices: taxIncluded,
      });

      // Update original values after successful save
      setOriginalTaxSettings({
        enabled: taxEnabled,
        rate: taxRate,
        name: taxName,
        currency: taxCurrency.toUpperCase(),
        included: taxIncluded,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving tax settings:", err);
      setTaxError(err.message || "Failed to save tax settings");
    } finally {
      setSavingTax(false);
    }
  };

  if (orgLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const canManageBilling = orgContext?.canManageBilling;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <AppLink
            href="/settings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Settings
          </AppLink>
          <h1 className="text-2xl font-bold">Billing Preferences</h1>
          <p className="text-muted-foreground mt-1">
            Configure how you bill your clients
          </p>
        </div>

        {!canManageBilling ? (
          <div className="p-6 rounded-xl border border-border bg-card">
            <p className="text-sm text-muted-foreground">
              You don't have permission to manage billing preferences. Contact your organization administrator.
            </p>
          </div>
        ) : (
          <>
            {/* Billing Currency */}
            <div className="mb-6 p-6 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Billing Currency</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Set the default currency for all billing operations. This affects how catalog item prices are displayed and billed to clients.
              </p>

              {currencyError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                  {currencyError}
                </div>
              )}

              {saveSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                  Settings saved successfully!
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Currency
                  </label>
                  <select
                    value={billingCurrency}
                    onChange={(e) => setBillingCurrency(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="NZD">NZD - New Zealand Dollar</option>
                    <option value="ZAR">ZAR - South African Rand</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-2">
                    Changing the currency will update how all existing catalog items are displayed. You may need to manually adjust prices if converting between currencies.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveBillingCurrency}
                    disabled={savingCurrency || !isCurrencyDirty}
                  >
                    {savingCurrency ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Currency"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Tax Settings */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Tax Settings</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Configure tax rates for client invoices and billing
              </p>

              {taxError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                  {taxError}
                </div>
              )}

              <div className="space-y-4">
                {/* Enable Tax */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tax-enabled"
                    checked={taxEnabled}
                    onChange={(e) => setTaxEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="tax-enabled" className="text-sm font-medium">
                    Enable tax on client invoices
                  </label>
                </div>

                {taxEnabled && (
                  <>
                    {/* Tax Name and Rate */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Tax Name
                        </label>
                        <input
                          type="text"
                          value={taxName}
                          onChange={(e) => setTaxName(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                          placeholder="e.g., Sales Tax, VAT, GST"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Tax Rate (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={taxRate}
                          onChange={(e) => setTaxRate(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                          placeholder="8.5"
                        />
                      </div>
                    </div>

                    {/* Currency */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Currency
                      </label>
                      <select
                        value={taxCurrency}
                        onChange={(e) => setTaxCurrency(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="CAD">CAD - Canadian Dollar</option>
                        <option value="AUD">AUD - Australian Dollar</option>
                        <option value="NZD">NZD - New Zealand Dollar</option>
                      </select>
                    </div>

                    {/* Tax Included */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="tax-included"
                        checked={taxIncluded}
                        onChange={(e) => setTaxIncluded(e.target.checked)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <label htmlFor="tax-included" className="text-sm">
                        Tax is included in item prices (tax-inclusive pricing)
                      </label>
                    </div>
                  </>
                )}

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveTaxSettings}
                    disabled={savingTax || !isTaxDirty}
                  >
                    {savingTax ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Tax Settings"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
