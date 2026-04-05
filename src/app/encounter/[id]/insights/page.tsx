'use client';

import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { OrderSuggestionsPanel } from '@/components/encounter/OrderSuggestionsPanel';

export default function EncounterInsightsPage() {
  const params = useParams();
  const encounterId = params.id as string;

  const encounter = useQuery(api.encounters.getById, { id: encounterId as Id<'encounters'> });
  const isEditable = encounter?.status !== 'published';

  return (
    <Layout>
      <BillingGuard feature="Encounters">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">

          <AppLink
            href={`/encounter/${encounterId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to encounter
          </AppLink>

          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Insights</h1>
          </div>

          {encounter === undefined && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {encounter && (encounter.suggestedOrders || encounter.orderExtractionStatus === 'processing') && (
            <OrderSuggestionsPanel
              encounterId={encounterId as Id<'encounters'>}
              suggestedOrders={encounter.suggestedOrders as any}
              orderExtractionStatus={encounter.orderExtractionStatus}
              isEditable={isEditable}
            />
          )}

        </div>
      </BillingGuard>
    </Layout>
  );
}
