'use client';

import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { ResultsTriagePanel } from '@/components/encounter/ResultsTriagePanel';
import { OrderSuggestionsPanel } from '@/components/encounter/OrderSuggestionsPanel';
import { useOrgCtx } from '@/app/providers/org-context-provider';

export default function EncounterInsightsPage() {
  const params = useParams();
  const encounterId = params.id as string;
  const { orgContext } = useOrgCtx();

  const encounter = useQuery(api.encounters.getById, { id: encounterId as Id<'encounters'> });
  const patient = useQuery(
    api.patients.getPatientById,
    encounter?.patientId ? { id: encounter.patientId as Id<'patients'> } : 'skip'
  );
  const detail = useQuery(api.encounters.getConsultationDetail, {
    encounterId: encounterId as Id<'encounters'>,
  });

  const isEditable = encounter?.status !== 'published';
  const extractionAttempted = !!detail?.factReconciliation?.reconciledAt;

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

          {encounter?.patientId && (encounter.orgId || orgContext?.orgId) && (
            <ResultsTriagePanel
              encounterId={encounterId as Id<'encounters'>}
              patientId={encounter.patientId as Id<'patients'>}
              orgId={(encounter.orgId ?? orgContext?.orgId) as Id<'organizations'>}
              providerId={encounter.providerId}
              patientPhone={patient?.emergencyContact?.phone}
              isEditable={isEditable}
              extractionAttempted={extractionAttempted}
            />
          )}

        </div>
      </BillingGuard>
    </Layout>
  );
}
