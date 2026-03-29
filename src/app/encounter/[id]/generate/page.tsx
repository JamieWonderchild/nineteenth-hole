'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { WorkflowPanel } from '@/components/encounter/WorkflowPanel';
import { PriorConsultationSelector } from '@/components/encounter/PriorConsultationSelector';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

const GROUP_LABELS: Record<string, string> = {
  'chief-complaint': 'Chief Complaint',
  'history-of-present-illness': 'History of Present Illness',
  'past-medical-history': 'Past Medical History',
  'past-surgical-history': 'Past Surgical History',
  medications: 'Medications',
  allergies: 'Allergies',
  'family-history': 'Family History',
  'social-history': 'Social History',
  'review-of-systems': 'Review of Systems',
  'physical-exam': 'Physical Exam',
  vitals: 'Vitals',
  assessment: 'Assessment',
  plan: 'Plan',
  demographics: 'Patient Info',
  'medical-history': 'Medical History',
};

function getGroupLabel(group: string): string {
  return GROUP_LABELS[group] || group.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getGroupColors(group: string): { border: string; text: string } {
  const colors: Record<string, { border: string; text: string }> = {
    'chief-complaint':            { border: 'border-l-red-400',    text: 'text-red-700 dark:text-red-300' },
    'history-of-present-illness': { border: 'border-l-orange-400', text: 'text-orange-700 dark:text-orange-300' },
    medications:                  { border: 'border-l-blue-400',   text: 'text-blue-700 dark:text-blue-300' },
    allergies:                    { border: 'border-l-pink-400',   text: 'text-pink-700 dark:text-pink-300' },
    assessment:                   { border: 'border-l-purple-400', text: 'text-purple-700 dark:text-purple-300' },
    plan:                         { border: 'border-l-green-400',  text: 'text-green-700 dark:text-green-300' },
    vitals:                       { border: 'border-l-cyan-400',   text: 'text-cyan-700 dark:text-cyan-300' },
    demographics:                 { border: 'border-l-gray-400',   text: 'text-gray-700 dark:text-gray-300' },
    'physical-exam':              { border: 'border-l-teal-400',   text: 'text-teal-700 dark:text-teal-300' },
    'past-medical-history':       { border: 'border-l-amber-400',  text: 'text-amber-700 dark:text-amber-300' },
  };
  return colors[group] || { border: 'border-l-muted-foreground', text: 'text-muted-foreground' };
}

export default function GenerateDocumentsPage() {
  const params = useParams();
  const { user } = useUser();
  const encounterId = params.id as string;

  const encounter = useQuery(
    api.encounters.getById,
    { id: encounterId as Id<'encounters'> }
  );

  const patient = useQuery(
    api.patients.getPatientById,
    encounter?.patientId
      ? { id: encounter.patientId as Id<'patients'> }
      : 'skip'
  );

  const detail = useQuery(
    api.encounters.getConsultationDetail,
    { encounterId: encounterId as Id<'encounters'> }
  );

  const evidenceFiles = useQuery(
    api.evidenceFiles.getByConsultation,
    { encounterId: encounterId as Id<'encounters'> }
  );

  // Prior context state
  const [priorContext, setPriorContext] = useState<Array<{ encounterId: string; date: string; facts: Array<{ id: string; text: string; group: string }>; diagnosis?: string }>>([]);

  // Derive evidence findings from file notes
  const evidenceFindings = useMemo(() => {
    if (!evidenceFiles) return [];
    const findings: Array<{ id: string; text: string; group: string }> = [];
    for (const file of evidenceFiles) {
      if (file.notes) {
        findings.push({
          id: `evidence-${file._id}`,
          text: file.notes,
          group: 'assessment',
        });
      }
    }
    return findings;
  }, [evidenceFiles]);

  // Aggregate facts from recordings + evidence, respecting reconciliation
  const aggregatedFacts = useMemo(() => {
    if (!detail?.recordings) return [];

    const reconciliation = detail.factReconciliation;

    if (reconciliation) {
      const resolvedFacts: Array<{ id: string; text: string; group: string }> = [];
      const seenTexts = new Set<string>();

      for (const rf of reconciliation.reconciledFacts) {
        if (rf.resolution === 'keep-old' && rf.priorText) {
          const key = rf.priorText.toLowerCase().trim();
          if (!seenTexts.has(key)) {
            seenTexts.add(key);
            resolvedFacts.push({ id: rf.priorFactId || rf.factId, text: rf.priorText, group: rf.group });
          }
          continue;
        }
        const key = rf.text.toLowerCase().trim();
        if (!seenTexts.has(key)) {
          seenTexts.add(key);
          resolvedFacts.push({ id: rf.factId, text: rf.text, group: rf.group });
        }
      }

      for (const finding of evidenceFindings) {
        const key = finding.text.toLowerCase().trim();
        if (!seenTexts.has(key)) {
          seenTexts.add(key);
          resolvedFacts.push(finding);
        }
      }

      return resolvedFacts;
    }

    // No reconciliation — standard dedup merge
    const seenTexts = new Set<string>();
    const facts: Array<{ id: string; text: string; group: string }> = [];
    for (const rec of detail.recordings) {
      if (rec.facts) {
        for (const fact of rec.facts) {
          const key = fact.text.toLowerCase().trim();
          if (!seenTexts.has(key)) {
            seenTexts.add(key);
            facts.push(fact);
          }
        }
      }
    }
    for (const finding of evidenceFindings) {
      const key = finding.text.toLowerCase().trim();
      if (!seenTexts.has(key)) {
        seenTexts.add(key);
        facts.push(finding);
      }
    }
    return facts;
  }, [detail?.recordings, detail?.factReconciliation, evidenceFindings]);

  // Group facts for sidebar display
  const factGroups = useMemo(() => {
    const seen = new Set<string>();
    const deduped = aggregatedFacts.filter((f) => {
      const key = `${f.group}::${f.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return deduped.reduce<Record<string, Array<{ id: string; text: string; group: string }>>>((acc, f) => {
      (acc[f.group] = acc[f.group] || []).push(f);
      return acc;
    }, {});
  }, [aggregatedFacts]);

  // Check if documents already exist (for regeneration label)
  const existingDocCount = useMemo(() => {
    if (!encounter?.generatedDocuments) return 0;
    return Object.values(encounter.generatedDocuments).filter(Boolean).length;
  }, [encounter?.generatedDocuments]);

  // Use encounter.interactionId if available, otherwise fall back to first recording's interactionId
  const interactionId = encounter?.interactionId || (detail?.recordings?.[0]?.interactionId);

  if (encounter === undefined || detail === undefined) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (encounter === null || detail === null) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto p-6 text-center space-y-4">
          <p className="text-muted-foreground">Encounter not found</p>
          <AppLink href="/encounter" className="text-sm text-primary hover:underline">
            Back to Encounters
          </AppLink>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <BillingGuard feature="Encounters">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-5">
          {/* Header */}
          <div className="space-y-1">
            <AppLink
              href={`/encounter/${encounterId}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to encounter
            </AppLink>
            <h1 className="text-xl font-semibold">
              {patient?.name || 'Patient'} — Generate Documents
            </h1>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left column — WorkflowPanel + PriorConsultationSelector */}
            <div className="lg:col-span-3 space-y-5">
              <div className="rounded-lg border bg-card p-5">
                <WorkflowPanel
                  interactionId={interactionId!}
                  facts={aggregatedFacts}
                  transcript={encounter.transcription}
                  patientInfo={patient ? {
                    name: patient.name,
                    age: patient.age,
                    weight: patient.weight ? parseFloat(patient.weight) : undefined,
                    weightUnit: (patient.weightUnit as 'kg' | 'lbs') || undefined,
                  } : undefined}
                  previousDocuments={existingDocCount > 0 ? [] : undefined}
                  isRegeneration={existingDocCount > 0}
                  evidenceFindings={evidenceFindings.length > 0 ? evidenceFindings : undefined}
                  priorContext={priorContext.length > 0 ? priorContext : undefined}
                  encounterId={encounterId}
                />
              </div>

              {/* Prior encounter context */}
              {patient && encounter.patientId && (
                <PriorConsultationSelector
                  patientId={encounter.patientId as unknown as string}
                  currentConsultationId={encounterId}
                  onPriorContextChange={setPriorContext}
                />
              )}
            </div>

            {/* Right column — Facts sidebar (read-only) */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Facts ({aggregatedFacts.length})
              </h3>
              <div className="max-h-[calc(100vh-14rem)] overflow-y-auto rounded-lg border bg-card p-4">
                {aggregatedFacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No facts extracted</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(factGroups).map(([group, groupFacts]) => {
                      const colors = getGroupColors(group);
                      return (
                        <div key={group} className={`border-l-[3px] ${colors.border} pl-3 py-1 space-y-1`}>
                          <h5 className={`text-xs font-semibold ${colors.text}`}>
                            {getGroupLabel(group)}
                          </h5>
                          <ul className="space-y-0.5">
                            {groupFacts.map((f) => (
                              <li key={f.id} className="text-sm text-foreground">
                                {f.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </BillingGuard>
    </Layout>
  );
}
