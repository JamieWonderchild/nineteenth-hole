'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { DocumentViewer } from '@/components/encounter/DocumentViewer';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Loader2,
  FileText,
  RefreshCw,
  Sparkles,
  X,
  Check,
  Download,
  Hospital,
} from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { toast } from '@/hooks/use-toast';

// All 9 doc types in display order, with DB key and API doc type ID
const ALL_DOC_TYPES = [
  { dbKey: 'soapNote', apiId: 'soap-note', label: 'SOAP Note' },
  { dbKey: 'afterVisitSummary', apiId: 'after-visit-summary', label: 'After-Visit Summary' },
  { dbKey: 'dischargeInstructions', apiId: 'discharge-instructions', label: 'Discharge Instructions' },
  { dbKey: 'referralLetter', apiId: 'referral-letter', label: 'Referral Letter' },
  { dbKey: 'prescription', apiId: 'prescription', label: 'Prescription' },
  { dbKey: 'followUpPlan', apiId: 'follow-up-plan', label: 'Follow-Up Plan' },
  { dbKey: 'labOrder', apiId: 'lab-order', label: 'Lab Order' },
  { dbKey: 'shiftHandoff', apiId: 'shift-handoff', label: 'Shift Handoff' },
  { dbKey: 'invoice', apiId: 'invoice', label: 'Invoice' },
] as const;

const API_ID_TO_DB_KEY: Record<string, string> = Object.fromEntries(
  ALL_DOC_TYPES.map(d => [d.apiId, d.dbKey])
);

type DocData = { sections: { key: string; title: string; content: string }[]; generatedAt: string };

export default function DocumentsPage() {
  const params = useParams();
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

  const saveDocsMutation = useMutation(api.encounters.saveGeneratedDocuments);

  // Map of dbKey → doc data for generated docs
  const generatedDocs = useMemo(() => {
    const docs = detail?.generatedDocuments || {};
    const map = new Map<string, DocData>();
    for (const [key, val] of Object.entries(docs)) {
      if (val && typeof val === 'object' && 'sections' in (val as object)) {
        map.set(key, val as DocData);
      }
    }
    return map;
  }, [detail?.generatedDocuments]);

  // Aggregate facts for single-doc generation
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
      return resolvedFacts;
    }
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
    return facts;
  }, [detail?.recordings, detail?.factReconciliation]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedForGeneration, setSelectedForGeneration] = useState<Set<string>>(new Set());
  const [isGeneratingMultiple, setIsGeneratingMultiple] = useState(false);
  const [isPushingToEpic, setIsPushingToEpic] = useState(false);
  const [epicPushedKeys, setEpicPushedKeys] = useState<Set<string>>(new Set());

  // Auto-select: prefer selectedKey if it's a valid dbKey, otherwise first generated doc
  const activeKey = selectedKey && ALL_DOC_TYPES.some(d => d.dbKey === selectedKey)
    ? selectedKey
    : generatedDocs.size > 0
      ? ALL_DOC_TYPES.find(d => generatedDocs.has(d.dbKey))?.dbKey ?? null
      : null;

  const activeDoc = activeKey ? generatedDocs.get(activeKey) ?? null : null;
  const activeDocType = ALL_DOC_TYPES.find(d => d.dbKey === activeKey);

  const addenda = detail?.addenda || [];
  const isEditable = encounter ? encounter.status !== 'published' : false;
  // Use encounter.interactionId if available, otherwise fall back to first recording's interactionId
  const interactionId = encounter?.interactionId || (detail?.recordings?.[0]?.interactionId);
  const hasInteraction = !!interactionId;
  const hasFacts = aggregatedFacts.length > 0;

  // Generate or regenerate a single document
  const handleGenerateSingle = useCallback(async (docType: typeof ALL_DOC_TYPES[number]) => {
    if (!interactionId || aggregatedFacts.length === 0) return;

    setGeneratingDocId(docType.dbKey);
    try {
      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactionId: interactionId,
          documents: [docType.apiId],
          facts: aggregatedFacts,
          transcript: encounter?.transcription || '',
          patientInfo: patient ? {
            name: patient.name,
            age: patient.age,
            weight: patient.weight ? parseFloat(patient.weight) : undefined,
            weightUnit: patient.weightUnit || undefined,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Generation failed (${response.status})`);
      }

      const data = await response.json();
      const docs = data.documents || [];

      if (docs.length === 0) {
        throw new Error('No content returned');
      }

      // Save to DB
      const timestamp = new Date().toISOString();
      const docPayload: Record<string, { sections: Array<{ key: string; title: string; content: string }>; generatedAt: string }> = {};
      for (const doc of docs) {
        const dbKey = API_ID_TO_DB_KEY[doc.type];
        if (dbKey) {
          docPayload[dbKey] = { sections: doc.sections, generatedAt: timestamp };
        }
      }

      await saveDocsMutation({
        encounterId: encounterId as Id<'encounters'>,
        ...docPayload,
      });

      setSelectedKey(docType.dbKey);
      toast({ title: `${docType.label} generated` });
    } catch (error) {
      console.error('[GenerateSingle] Error:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate document',
        variant: 'destructive',
      });
    } finally {
      setGeneratingDocId(null);
    }
  }, [interactionId, encounter, patient, aggregatedFacts, encounterId, saveDocsMutation]);

  // Generate multiple selected documents
  const handleGenerateMultiple = useCallback(async () => {
    if (!interactionId || aggregatedFacts.length === 0 || selectedForGeneration.size === 0) return;

    setIsGeneratingMultiple(true);
    try {
      const docApiIds = ALL_DOC_TYPES
        .filter(d => selectedForGeneration.has(d.dbKey))
        .map(d => d.apiId);

      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactionId: interactionId,
          documents: docApiIds,
          facts: aggregatedFacts,
          transcript: encounter?.transcription || '',
          patientInfo: patient ? {
            name: patient.name,
            age: patient.age,
            weight: patient.weight ? parseFloat(patient.weight) : undefined,
            weightUnit: patient.weightUnit || undefined,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Generation failed (${response.status})`);
      }

      const data = await response.json();
      const docs = data.documents || [];

      if (docs.length === 0) {
        throw new Error('No content returned');
      }

      // Save to DB
      const timestamp = new Date().toISOString();
      const docPayload: Record<string, { sections: Array<{ key: string; title: string; content: string }>; generatedAt: string }> = {};
      for (const doc of docs) {
        const dbKey = API_ID_TO_DB_KEY[doc.type];
        if (dbKey) {
          docPayload[dbKey] = { sections: doc.sections, generatedAt: timestamp };
        }
      }

      await saveDocsMutation({
        encounterId: encounterId as Id<'encounters'>,
        ...docPayload,
      });

      // Exit multi-select mode and show first generated doc
      setMultiSelectMode(false);
      setSelectedForGeneration(new Set());
      if (docs.length > 0) {
        const firstDbKey = API_ID_TO_DB_KEY[docs[0].type];
        if (firstDbKey) setSelectedKey(firstDbKey);
      }

      toast({ title: `${docs.length} document(s) generated` });
    } catch (error) {
      console.error('[GenerateMultiple] Error:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate documents',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingMultiple(false);
    }
  }, [interactionId, encounter, patient, aggregatedFacts, encounterId, saveDocsMutation, selectedForGeneration]);

  // Toggle pill in multi-select mode
  const handlePillClick = useCallback((docType: typeof ALL_DOC_TYPES[number]) => {
    if (multiSelectMode) {
      setSelectedForGeneration(prev => {
        const next = new Set(prev);
        if (next.has(docType.dbKey)) {
          next.delete(docType.dbKey);
        } else {
          next.add(docType.dbKey);
        }
        return next;
      });
    } else {
      setSelectedKey(docType.dbKey);
    }
  }, [multiSelectMode]);

  // Enter/exit multi-select mode
  const toggleMultiSelectMode = useCallback(() => {
    if (multiSelectMode) {
      // Exiting: clear selections
      setMultiSelectMode(false);
      setSelectedForGeneration(new Set());
    } else {
      // Entering: clear any selected key
      setMultiSelectMode(true);
      setSelectedKey(null);
    }
  }, [multiSelectMode]);

  // Export note as a plain-text file (non-Epic fallback)
  const handleExportText = useCallback((docKey: string, sections: { key: string; title: string; content: string }[], label: string) => {
    const text = sections.map((s) => `${s.title}\n${'─'.repeat(s.title.length)}\n${s.content}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${encounterId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded' });
  }, [encounterId]);

  // Push note to Epic via FHIR DocumentReference
  const handlePushToEpic = useCallback(async (docKey: string, sections: { key: string; title: string; content: string }[], label: string) => {
    const epicPatientId = encounter?.epicPatientId as string | undefined;
    if (!epicPatientId) {
      // Redirect to SMART launch so the provider connects their Epic session
      window.open('/fhir-launch', '_blank', 'width=700,height=600');
      toast({
        title: 'Connect to Epic first',
        description: 'A window has opened to link your Epic account.',
      });
      return;
    }

    setIsPushingToEpic(true);
    try {
      const noteText = sections.map((s) => `${s.title}\n${s.content}`).join('\n\n');
      const res = await fetch('/api/fhir/push-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientFhirId: epicPatientId,
          encounterFhirId: encounter?.epicEncounterId as string | undefined,
          docTitle: label,
          noteText,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        if (res.status === 401) {
          window.open('/fhir-launch', '_blank', 'width=700,height=600');
          throw new Error('Session expired — reconnect to Epic via the opened window.');
        }
        throw new Error(err.error || `Push failed (${res.status})`);
      }

      setEpicPushedKeys((prev) => new Set([...prev, docKey]));
      toast({ title: 'Pushed to Epic', description: `${label} added to patient chart.` });
    } catch (error) {
      toast({
        title: 'Epic push failed',
        description: error instanceof Error ? error.message : 'Could not push to Epic',
        variant: 'destructive',
      });
    } finally {
      setIsPushingToEpic(false);
    }
  }, [encounter, encounterId]);

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
        <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-5">
          {/* Header */}
          <div className="space-y-1">
            <AppLink
              href={`/encounter/${encounterId}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to encounter
            </AppLink>
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold">
                {patient?.name || 'Patient'} — Documents
              </h1>
              {isEditable && hasInteraction && (
                <div className="flex items-center gap-2">
                  {multiSelectMode && selectedForGeneration.size > 0 && (
                    <Button
                      size="sm"
                      onClick={handleGenerateMultiple}
                      disabled={isGeneratingMultiple}
                      className="gap-1.5"
                    >
                      {isGeneratingMultiple ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Generate {selectedForGeneration.size} Selected
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={multiSelectMode ? "default" : "outline"}
                    onClick={toggleMultiSelectMode}
                    className="gap-1.5"
                  >
                    {multiSelectMode ? (
                      <>
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Generate Multiple
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* No recordings state */}
          {!hasInteraction ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 rounded-lg border bg-card">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-medium">No documents yet</p>
                <p className="text-sm text-muted-foreground">
                  Record a encounter first to generate documents.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Pill selector — all 7 doc types */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {ALL_DOC_TYPES.map((docType) => {
                  const isGenerated = generatedDocs.has(docType.dbKey);
                  const isActive = !multiSelectMode && docType.dbKey === activeKey;
                  const isLoading = generatingDocId === docType.dbKey;
                  const isSelected = multiSelectMode && selectedForGeneration.has(docType.dbKey);

                  return (
                    <button
                      key={docType.dbKey}
                      onClick={() => handlePillClick(docType)}
                      disabled={isLoading || isGeneratingMultiple}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : isSelected
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-500/50'
                            : isGenerated
                              ? 'bg-muted text-foreground hover:bg-muted/80'
                              : 'border border-dashed border-muted-foreground/30 text-muted-foreground/60 hover:border-muted-foreground/50 hover:text-muted-foreground'
                      } ${isLoading || isGeneratingMultiple ? 'opacity-70' : ''}`}
                    >
                      {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                      {isSelected && <Check className="h-3 w-3" />}
                      {docType.label}
                    </button>
                  );
                })}
              </div>

              {/* Content area */}
              {multiSelectMode ? (
                /* Multi-select mode — show selection prompt */
                <div className="flex flex-col items-center justify-center py-16 space-y-4 rounded-lg border bg-card">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-lg font-medium">
                      {selectedForGeneration.size === 0
                        ? 'Select documents to generate'
                        : `${selectedForGeneration.size} document(s) selected`}
                    </p>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {selectedForGeneration.size === 0
                        ? 'Click the document pills above to select which ones you want to generate.'
                        : 'Click "Generate Selected" above to generate all selected documents at once.'}
                    </p>
                  </div>
                </div>
              ) : activeKey && activeDoc ? (
                /* Viewing a generated document */
                <div className="rounded-lg border bg-card p-5 sm:p-6">
                  <DocumentViewer
                    title={activeDocType?.label || activeKey}
                    sections={activeDoc.sections}
                    generatedAt={activeDoc.generatedAt}
                    encounterId={encounterId}
                    docKey={activeKey}
                    headerActions={(
                      <div className="flex items-center gap-1">
                        {isEditable && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-xs text-muted-foreground"
                            disabled={!!generatingDocId}
                            onClick={() => activeDocType && handleGenerateSingle(activeDocType)}
                          >
                            {generatingDocId === activeKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            Regenerate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-xs text-muted-foreground"
                          onClick={() => activeDoc && activeDocType && handleExportText(activeKey!, activeDoc.sections, activeDocType.label)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`gap-1.5 text-xs ${epicPushedKeys.has(activeKey!) ? 'text-green-600' : 'text-muted-foreground'}`}
                          disabled={isPushingToEpic}
                          onClick={() => activeDoc && activeDocType && handlePushToEpic(activeKey!, activeDoc.sections, activeDocType.label)}
                        >
                          {isPushingToEpic ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : epicPushedKeys.has(activeKey!) ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Hospital className="h-3.5 w-3.5" />
                          )}
                          {epicPushedKeys.has(activeKey!) ? 'Pushed' : 'Push to Epic'}
                        </Button>
                      </div>
                    )}
                  />
                </div>
              ) : activeKey && !activeDoc ? (
                /* Selected an ungenerated doc type */
                <div className="flex flex-col items-center justify-center py-12 space-y-4 rounded-lg border bg-card">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-base font-medium">
                      {activeDocType?.label || 'Document'} not generated yet
                    </p>
                    {hasFacts ? (
                      <p className="text-sm text-muted-foreground">
                        Generate this document from the encounter facts.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No facts available. Record a encounter first.
                      </p>
                    )}
                  </div>
                  {isEditable && hasFacts && activeDocType && (
                    <Button
                      className="gap-2"
                      disabled={!!generatingDocId}
                      onClick={() => handleGenerateSingle(activeDocType)}
                    >
                      {generatingDocId === activeDocType.dbKey ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Generate {activeDocType.label}
                    </Button>
                  )}
                </div>
              ) : (
                /* No doc selected, no docs generated — point to generate page */
                <div className="flex flex-col items-center justify-center py-16 space-y-4 rounded-lg border bg-card">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-lg font-medium">No documents generated yet</p>
                    <p className="text-sm text-muted-foreground">
                      Select a document type above, or generate multiple at once.
                    </p>
                  </div>
                  {isEditable && (
                    <AppLink href={`/encounter/${encounterId}/generate`}>
                      <Button className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Generate Documents
                      </Button>
                    </AppLink>
                  )}
                </div>
              )}
            </>
          )}

          {/* Addenda */}
          {addenda.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Addenda ({addenda.length})
              </h3>
              <div className="space-y-3">
                {addenda.map((a, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-1.5">
                    <p className="text-sm whitespace-pre-wrap">{a.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </BillingGuard>
    </Layout>
  );
}
