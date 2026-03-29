'use client';

import { useSearchParams } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DollarSign } from 'lucide-react';
import { useOrgCtx } from "@/app/providers/org-context-provider";
import { BillingGuard } from "@/components/billing/BillingGuard";
import { useAppRouter } from '@/hooks/useAppRouter';
import { OverviewTab } from './components/OverviewTab';
import { CatalogTab } from './components/CatalogTab';
import { InvoicesTab } from './components/InvoicesTab';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useAppRouter();
  const { orgContext } = useOrgCtx();

  const currentTab = searchParams.get('tab') || 'overview';

  const handleTabChange = (tab: string) => {
    // Validate tab value
    if (tab !== 'overview' && tab !== 'catalog' && tab !== 'invoices') {
      tab = 'overview';
    }
    router.push('/billing', { additionalParams: { tab } });
  };

  const handleSwitchToCatalog = () => handleTabChange('catalog');
  const handleSwitchToInvoices = () => handleTabChange('invoices');

  return (
    <Layout>
      <BillingGuard feature="Billing">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Billing</h1>
              <p className="text-sm text-muted-foreground">
                Create invoices, track revenue, and manage your billing catalog
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="catalog">Catalog</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 min-h-[500px] rounded-lg border border-border bg-card/30 p-6">
              <OverviewTab
                orgContext={orgContext}
                isLoading={!orgContext}
                onSwitchToCatalog={handleSwitchToCatalog}
                onSwitchToInvoices={handleSwitchToInvoices}
              />
            </TabsContent>

            <TabsContent value="invoices" className="mt-0 min-h-[500px] rounded-lg border border-border bg-card/30 p-6">
              <InvoicesTab orgContext={orgContext} />
            </TabsContent>

            <TabsContent value="catalog" className="mt-0 min-h-[500px] rounded-lg border border-border bg-card/30 p-6">
              <CatalogTab
                orgContext={orgContext}
                canManageTeam={orgContext?.canManageTeam ?? false}
              />
            </TabsContent>
          </Tabs>
        </div>
      </BillingGuard>
    </Layout>
  );
}
