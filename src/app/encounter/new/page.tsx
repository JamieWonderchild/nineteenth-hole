'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stethoscope, Save, Check, Loader2, Sparkles, Search } from 'lucide-react';
import { CortiConsultation } from '@/components/encounter/CortiConsultation';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { toast } from '@/hooks/use-toast';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { useSearchParams } from 'next/navigation';
import type { EncounterSession } from '@/types/corti';
import type { ExtractedPatientRecord } from '@/services/corti-agents';
import { BillingGuard } from '@/components/billing/BillingGuard';
import type { Id } from 'convex/_generated/dataModel';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppRouter } from '@/hooks/useAppRouter';

export default function NewEncounterPage() {
  const { user } = useUser();
  const { orgContext } = useOrgCtx();
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const queryConsultationId = searchParams.get('encounterId') as Id<"encounters"> | null;
  const isMobileQuickStart = searchParams.get('mobile') === 'true';
  const isMobile = useIsMobile();

  const [sessionData, setSessionData] = useState<EncounterSession | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false); // NEW: Track auto-save in progress
  const [savedRecordingId, setSavedRecordingId] = useState<Id<"recordings"> | null>(null); // NEW: Track last saved recording

  // Multi-recording state — initialize from query param if continuing a draft
  const [encounterId, setConsultationId] = useState<Id<"encounters"> | null>(queryConsultationId);
  const [recordingCount, setRecordingCount] = useState(0);

  // Load draft encounter data if continuing
  const draftData = useQuery(
    api.encounters.getConsultationWithRecordings,
    queryConsultationId ? { encounterId: queryConsultationId } : 'skip'
  );

  // Extract patientId from draft (skip save dialog when already linked)
  const draftPatientId = draftData?.patientId as Id<"patients"> | undefined;

  // Debug logging
  React.useEffect(() => {
    console.log('[DRAFT DATA]', {
      queryConsultationId,
      hasDraftData: !!draftData,
      draftPatientId,
      patientId: draftData?.patientId,
    });
  }, [queryConsultationId, draftData, draftPatientId]);

  // Pre-populate facts from draft
  const draftFacts = useMemo(() => {
    if (!draftData) return [];
    return draftData.combinedFacts || [];
  }, [draftData]);

  const draftTranscript = useMemo(() => {
    if (!draftData) return '';
    return draftData.combinedTranscript || '';
  }, [draftData]);

  // Extracted data from form-filling agent
  const [extractedData, setExtractedData] = useState<ExtractedPatientRecord | null>(null);

  // Patient linking
  const [patientSearch, setPatientSearch] = useState('');
  const [linkedPatientId, setLinkedPatientId] = useState<Id<"patients"> | null>(null);

  // Editable patient info (initialized from extracted data)
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    age: '',
    weight: '',
    sex: '',
  });

  // Convex queries and mutations - prefer org-scoped
  const orgPatients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<"organizations"> } : 'skip'
  );
  const vetPatients = useQuery(
    api.patients.getPatientsByVet,
    !orgContext ? { providerId: user?.id ?? '' } : 'skip'
  );
  const existingPatients = orgPatients ?? vetPatients;
  const findOrCreatePatient = useMutation(api.patients.findOrCreatePatient);
  const saveConsultation = useMutation(api.encounters.saveVoiceConsultation);
  const updateCompanionContext = useMutation(api.companions.updateSessionContext);
  const recordUsage = useMutation(api.usage.record);
  const deleteRecording = useMutation(api.recordings.deleteRecording); // NEW: For "Record Again" cleanup
  const saveFactReconciliation = useMutation(api.encounters.saveFactReconciliation);

  // Filter patients by search query
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim() || !existingPatients) return [];
    const query = patientSearch.toLowerCase();
    return existingPatients.filter(
      (p) => p.name.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [patientSearch, existingPatients]);

  const handleLinkPatient = (patient: typeof existingPatients extends (infer T)[] | undefined ? T : never) => {
    if (!patient) return;
    setLinkedPatientId(patient._id);
    setPatientSearch('');
    setPatientInfo({
      name: patient.name,
      age: '',
      weight: patient.weight || '',
      sex: '',
    });
  };

  const handleClearLinkedPatient = () => {
    setLinkedPatientId(null);
  };

  // Handle "Record Again" - delete auto-saved recording
  const handleRecordAgain = useCallback(async () => {
    if (savedRecordingId && encounterId) {
      try {
        await deleteRecording({
          id: savedRecordingId,
          encounterId: encounterId,
        });
        toast({
          title: 'Recording Discarded',
          description: 'Previous recording has been deleted. You can record again.',
        });
        // Reset state
        setSavedRecordingId(null);
        setSessionData(null);
        setSaved(false);
      } catch (error) {
        console.error('Delete recording error:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete recording',
          variant: 'destructive',
        });
      }
    }
  }, [savedRecordingId, encounterId, deleteRecording]);

  // Extract patient info using the form-filling agent
  const extractPatientInfo = useCallback(async (transcript: string) => {
    setIsExtracting(true);
    try {
      const response = await fetch('/api/corti/extract-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        console.warn('Patient extraction failed (non-critical):', response.status);
        // Don't throw - patient extraction is optional and shouldn't block save
        return;
      }

      const data = await response.json();
      if (data.patientInfo) {
        setExtractedData(data.patientInfo);
        // Only pre-fill if no patient is linked
        if (!linkedPatientId) {
          setPatientInfo({
            name: data.patientInfo.patient?.name || '',
            age: data.patientInfo.patient?.age || '',
            weight: data.patientInfo.patient?.weight || '',
            sex: data.patientInfo.patient?.sex || '',
          });
        }
      }
    } catch (error) {
      console.error('Extraction error:', error);
      toast({
        title: 'Extraction Notice',
        description: 'Could not auto-extract patient info. Please fill in manually.',
      });
    } finally {
      setIsExtracting(false);
    }
  }, [linkedPatientId]);

  const handleSessionComplete = useCallback(async (session: EncounterSession) => {
    setSessionData(session);

    const transcript = session.transcriptText;

    if (transcript.length > 50) {
      await extractPatientInfo(transcript);
    }

    // Auto-save will be triggered by useEffect watching sessionData + draftPatientId
  }, [extractPatientInfo]);

  // AUTO-SAVE: Always save after recording completes (safety net)
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sessionData && user?.id && !saved && !isSaving && !isExtracting) {
      setAutoSaving(true);
      timer = setTimeout(() => {
        if (draftPatientId) {
          handleSave({ redirect: false }).finally(() => setAutoSaving(false));
        } else {
          setAutoSaving(false);
        }
      }, 2000);
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData, user?.id, saved, isSaving, isExtracting, draftPatientId]);

  const handleSave = async (options: { redirect?: boolean } = { redirect: true }) => {
    if (!user?.id || !sessionData) return;

    // When continuing a draft with existing patient, skip dialog entirely
    const resolvedPatientId = draftPatientId ?? linkedPatientId;

    if (!resolvedPatientId) {
      // Need dialog for patient selection — validate fields
      if (!patientInfo.name) {
        toast({
          title: 'Missing Information',
          description: 'Please provide the patient name',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSaving(true);

    try {
      let patientId: Id<"patients">;
      let created = false;

      if (resolvedPatientId) {
        patientId = resolvedPatientId;
      } else {
        const result = await findOrCreatePatient({
          providerId: user.id,
          orgId: orgContext?.orgId as Id<"organizations"> | undefined,
          name: patientInfo.name,
          age: patientInfo.age || undefined,
          weight: patientInfo.weight || undefined,
          weightUnit: 'kg',
          sex: patientInfo.sex || undefined,
        });
        patientId = result.patientId;
        created = result.created;
      }

      // Build extractedPatientInfo for enrichment (convert nulls to undefined)
      const extractedPatientInfoForSave = extractedData?.patient ? {
        name: extractedData.patient.name || undefined,
        age: extractedData.patient.age || undefined,
        weight: extractedData.patient.weight || undefined,
        sex: extractedData.patient.sex || undefined,
      } : undefined;

      const result = await saveConsultation({
        patientId,
        providerId: user.id,
        orgId: orgContext?.orgId as Id<"organizations"> | undefined,
        interactionId: sessionData.interactionId,
        transcription: sessionData.transcriptText,
        facts: sessionData.facts.map(f => ({
          id: f.id,
          text: f.text,
          group: f.group || f.groupId || 'unknown',
        })),
        physicalExam: extractedData?.encounter?.physicalExam ? {
          temperature: extractedData.encounter.physicalExam.temperature ?? undefined,
          weight: extractedData.encounter.physicalExam.weight ?? undefined,
          weightUnit: extractedData.encounter.physicalExam.weightUnit ?? undefined,
          heartRate: extractedData.encounter.physicalExam.heartRate ?? undefined,
          respiratoryRate: extractedData.encounter.physicalExam.respiratoryRate ?? undefined,
          notes: extractedData.encounter.physicalExam.notes ?? undefined,
        } : undefined,
        encounterId: encounterId ?? undefined,
        recordingDuration: sessionData.duration,
        extractedPatientInfo: extractedPatientInfoForSave,
      });

      // Track the encounterId and recordingId for subsequent recordings
      const cId = encounterId ?? result.encounterId as Id<"encounters">;
      if (!encounterId) {
        setConsultationId(cId);
      }
      setSavedRecordingId(result.recordingId as Id<"recordings">); // Track for "Record Again" deletion
      setRecordingCount(prev => prev + 1);

      // Update companion context if one exists (fire and forget)
      updateCompanionContext({ encounterId: cId }).catch(() => {});

      // Record usage for billing
      if (orgContext?.orgId && user.id) {
        recordUsage({
          orgId: orgContext.orgId as Id<"organizations">,
          userId: user.id,
          type: 'encounter',
        }).catch((err) => console.error('Usage recording failed:', err));
      }

      setSaved(true);
      setShowSaveDialog(false);

      const patientLabel = patientInfo.name || 'patient';
      // Only show toast and redirect if this is a manual save
      if (options.redirect) {
        toast({
          title: resolvedPatientId
            ? 'Encounter Saved'
            : created ? 'Patient Created & Encounter Saved' : 'Encounter Saved',
          description: resolvedPatientId
            ? `Encounter saved for "${patientLabel}"`
            : created
              ? `New patient "${patientLabel}" created with encounter record`
              : `Encounter saved for "${patientLabel}"`,
        });

        // Redirect to encounter detail page
        router.push(`/encounter/${cId}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Error Saving',
        description: error instanceof Error ? error.message : 'Failed to save encounter',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <BillingGuard feature="Encounters">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                {queryConsultationId ? 'Continue Encounter' : 'New Encounter'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {queryConsultationId
                  ? `Continuing draft with ${draftData?.recordings?.length || 0} recording(s)`
                  : 'Record and analyze a patient encounter'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExtracting && (
              <span className="flex items-center gap-1 text-sm text-primary">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Extracting patient info...
              </span>
            )}
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>
        </div>

        <CortiConsultation
          consultationType="sick-visit"
          onSessionComplete={handleSessionComplete}
          onRecordAgain={handleRecordAgain}
          encounterId={encounterId ?? undefined}
          initialFacts={draftFacts}
          initialTranscript={draftTranscript}
          isMobile={isMobile}
          mobileQuickStart={isMobileQuickStart}
        />

        {sessionData && (
          <div className="flex justify-center">
            <Button
              onClick={async () => {
                if (encounterId) {
                  // For draft encounters, ensure auto-save completes before navigating
                  if (draftPatientId && !saved && !isSaving) {
                    await handleSave({ redirect: false });
                  }

                  // Kick off fact reconciliation in background if 2+ recordings are present.
                  // draftData is reactive — if Convex has already reflected the new recording, fire now;
                  // otherwise the facts page will catch it as a fallback.
                  const recordings = draftData?.recordings;
                  if (recordings && recordings.length > 1) {
                    const existingRecs = recordings.slice(0, -1);
                    const lastRec = recordings[recordings.length - 1];
                    const existingFacts = existingRecs.flatMap((rec, idx) =>
                      (rec.facts || []).map((f: { id: string; text: string; group: string }) => ({ ...f, recordingIndex: idx }))
                    );
                    const newFacts = (lastRec.facts || []).map((f: { id: string; text: string; group: string }) => ({
                      ...f,
                      recordingIndex: recordings.length - 1,
                    }));
                    if (existingFacts.length > 0 && newFacts.length > 0) {
                      fetch('/api/corti/reconcile-facts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ existingFacts, newFacts }),
                      })
                        .then(res => res.json())
                        .then(async data => {
                          if (data.success && data.reconciliation) {
                            const sanitized = {
                              ...data.reconciliation,
                              triggerRecordingCount: recordings.length,
                              reconciledFacts: data.reconciliation.reconciledFacts.map(
                                (rf: Record<string, unknown>) => ({
                                  ...rf,
                                  priorFactId: rf.priorFactId ?? undefined,
                                  priorText: rf.priorText ?? undefined,
                                  priorRecordingIndex: rf.priorRecordingIndex ?? undefined,
                                  resolution: rf.resolution ?? undefined,
                                  resolvedAt: rf.resolvedAt ?? undefined,
                                })
                              ),
                            };
                            await saveFactReconciliation({
                              encounterId,
                              factReconciliation: sanitized,
                            });
                          }
                        })
                        .catch(err => console.error('[Reconciliation] Background trigger failed:', err));
                    }
                  }

                  // Navigate back to encounter
                  router.push(`/encounter/${encounterId}`);
                } else if (saved) {
                  // Saved but no encounterId somehow - shouldn't happen
                  toast({ title: 'Error', description: 'Encounter ID missing', variant: 'destructive' });
                } else {
                  // New encounter - trigger save dialog
                  setShowSaveDialog(true);
                }
              }}
              disabled={isSaving || autoSaving}
              className="gap-2"
            >
              {(isSaving || autoSaving) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {(isSaving || autoSaving) ? 'Saving...' : 'Back to Encounter'}
            </Button>
          </div>
        )}

        {/* Save Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Save Encounter
              </DialogTitle>
              <DialogDescription>
                Link to an existing patient or let AI fill in details from the recording.
                {extractedData?.confidence?.patientIdentification === 'high' && (
                  <span className="text-green-600 ml-1">(High confidence)</span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Patient Search / Link */}
              <div className="space-y-2">
                <Label>Link to Existing Patient</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search patients by name..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      if (linkedPatientId) handleClearLinkedPatient();
                    }}
                    className="pl-9"
                  />
                </div>
                {filteredPatients.length > 0 && (
                  <div className="border rounded-md overflow-hidden">
                    {filteredPatients.map((p) => (
                      <button
                        key={p._id}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-b-0"
                        onClick={() => handleLinkPatient(p)}
                      >
                        <span className="font-medium">{p.name}</span>
                        {(p.age || p.sex) && (
                          <span className="text-muted-foreground ml-2">
                            {[p.age, p.sex].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {linkedPatientId && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded text-sm text-green-700">
                    <Check className="h-4 w-4" />
                    <span>Linked to existing patient: <strong>{patientInfo.name}</strong></span>
                    <button
                      className="ml-auto text-green-600 hover:text-green-800 underline text-xs"
                      onClick={handleClearLinkedPatient}
                    >
                      Unlink
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {linkedPatientId ? 'Linked patient info' : 'Or create new patient'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Patient Name *</Label>
                <Input
                  id="name"
                  value={patientInfo.name}
                  onChange={(e) => {
                    setPatientInfo(prev => ({ ...prev, name: e.target.value }));
                    if (linkedPatientId) handleClearLinkedPatient();
                  }}
                  placeholder="e.g., Jane Smith"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    value={patientInfo.age}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, age: e.target.value }))}
                    placeholder="e.g., 5 years"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Weight</Label>
                  <Input
                    id="weight"
                    value={patientInfo.weight}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, weight: e.target.value }))}
                    placeholder="e.g., 25 kg"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sex</Label>
                  <Select
                    value={patientInfo.sex}
                    onValueChange={(value) => setPatientInfo(prev => ({ ...prev, sex: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Extracted vitals preview */}
              {extractedData?.encounter?.physicalExam && (
                <div className="p-3 bg-primary/5 rounded-lg text-sm">
                  <p className="font-medium text-primary mb-1">Extracted Vitals:</p>
                  <div className="text-foreground grid grid-cols-2 gap-1">
                    {extractedData.encounter.physicalExam.temperature && (
                      <span>Temp: {extractedData.encounter.physicalExam.temperature}&deg;C</span>
                    )}
                    {extractedData.encounter.physicalExam.heartRate && (
                      <span>HR: {extractedData.encounter.physicalExam.heartRate} bpm</span>
                    )}
                    {extractedData.encounter.physicalExam.respiratoryRate && (
                      <span>RR: {extractedData.encounter.physicalExam.respiratoryRate}/min</span>
                    )}
                    {extractedData.encounter.physicalExam.weight && (
                      <span>Weight: {extractedData.encounter.physicalExam.weight} kg</span>
                    )}
                  </div>
                </div>
              )}

              {/* Summary of what will be saved */}
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-1">Will save:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>&bull; {sessionData?.facts.length || 0} extracted facts</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleSave({ redirect: true })} disabled={isSaving || !patientInfo.name}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </BillingGuard>
    </Layout>
  );
}
