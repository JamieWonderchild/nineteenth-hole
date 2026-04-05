'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useAppRouter } from '@/hooks/useAppRouter';
import { useUser } from '@clerk/nextjs';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { AddAddendumDialog } from '@/components/encounter/AddAddendumDialog';
import { DictationModal } from '@/components/encounter/DictationModal';
import { RecordingTimeline } from '@/components/encounter/RecordingTimeline';
import { PlannedServicesWidget } from '@/components/billing/PlannedServicesWidget';
import { MedicalCodingPanel } from '@/components/encounter/MedicalCodingPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Mic,
  Trash2,
  Plus,
  Copy,
  Check,
  Loader2,
  Send,
  Sparkles,
  X,
  Upload,
  RefreshCw,
  RotateCcw,
  Stethoscope,
  User,
  Mail,
  Phone,
  Heart,
  MessageSquare,
  ExternalLink,
  FileText,
  ClipboardList,
  ChevronRight,
  ChevronDown,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AppLink } from '@/components/navigation/AppLink';
import { toast } from '@/hooks/use-toast';
import { extractAndSaveNoteFacts } from '@/lib/noteFactsExtraction';
import { useNoteReconciliation } from '@/hooks/useNoteReconciliation';

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  'in-progress': {
    label: 'In Progress',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  review: {
    label: 'Review',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  published: {
    label: 'Published',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
};

export default function ConsultationDetailPage() {
  const params = useParams();
  const router = useAppRouter();
  const { user } = useUser();
  const { orgContext } = useOrgCtx();
  const isAdmin = orgContext?.isAdmin ?? false;
  const encounterId = params.id as string;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showAddendum, setShowAddendum] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCreatingCompanion, setIsCreatingCompanion] = useState(false);
  const [companionUrl, setCompanionUrl] = useState<string | null>(null);
  const [showCompanionModal, setShowCompanionModal] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [codingExpanded, setCodingExpanded] = useState(false);


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

  // Org query for clinic info (companion creation)
  const organization = useQuery(
    api.organizations.getById,
    encounter?.orgId ? { id: encounter.orgId as Id<'organizations'> } : 'skip'
  );

  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [viewingNote, setViewingNote] = useState<{ index: number; text: string; createdAt: string } | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const deleteDraft = useMutation(api.encounters.deleteDraftConsultation);
  const publishConsultation = useMutation(api.encounters.publishConsultation);
  const unpublishConsultationMut = useMutation(api.encounters.unpublishConsultation);
  const updateSessionContext = useMutation(api.companions.updateSessionContext);
  const updatePatient = useMutation(api.patients.updatePatient);
  const clearExtractedPatientInfo = useMutation(api.encounters.clearExtractedPatientInfo);
  const resolveFactConflict = useMutation(api.encounters.resolveFactConflict);
  const updateAddendum = useMutation(api.encounters.updateAddendum);
  const createRecording = useMutation(api.recordings.createRecording);
  const setAddendumFactCount = useMutation(api.encounters.setAddendumFactCount);
  const { runReconciliation } = useNoteReconciliation(encounterId as Id<'encounters'>);

  // Attachments
  const generateUploadUrl = useMutation(api.evidenceFiles.generateUploadUrl);
  const createEvidenceFile = useMutation(api.evidenceFiles.createEvidenceFile);
  const deleteEvidenceFile = useMutation(api.evidenceFiles.deleteEvidenceFile);
  const evidenceFiles = useQuery(
    api.evidenceFiles.getByConsultation,
    { encounterId: encounterId as Id<'encounters'> }
  );
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const { storageId } = await res.json();
        await createEvidenceFile({
          encounterId: encounterId as Id<'encounters'>,
          storageId,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          category: 'other',
          uploadedBy: user?.id || 'system',
        });
      }
    } catch (err) {
      toast({ title: 'Upload failed', variant: 'destructive' });
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [encounterId, generateUploadUrl, createEvidenceFile, user?.id]);

  const handleDeleteFile = useCallback(async (fileId: string) => {
    try {
      await deleteEvidenceFile({ id: fileId as Id<'evidenceFiles'> });
    } catch (err) {
      console.error(err);
    }
  }, [deleteEvidenceFile]);

  // Card grid counts
  const docCount = useMemo(() => {
    if (!encounter?.generatedDocuments) return 0;
    return Object.values(encounter.generatedDocuments).filter(Boolean).length;
  }, [encounter?.generatedDocuments]);

  const factCount = detail?.facts?.length ?? 0;

  // Enrichment banner: compare extracted patient info vs current patient record
  const enrichableFields = useMemo(() => {
    const extracted = encounter?.extractedPatientInfo;
    if (!extracted || !patient) return [];

    const fieldMap: Array<{ key: string; label: string; value: string }> = [];
    const check = (key: string, label: string, extractedVal?: string, patientVal?: string) => {
      if (extractedVal && !patientVal) {
        fieldMap.push({ key, label, value: extractedVal });
      }
    };

    check('age', 'Age', extracted.age, patient.age);
    check('sex', 'Sex', extracted.sex, patient.sex);
    check('weight', 'Weight', extracted.weight, patient.weight);

    return fieldMap;
  }, [encounter?.extractedPatientInfo, patient]);

  const [enrichmentChecked, setEnrichmentChecked] = useState<Record<string, boolean>>({});

  // Initialize all enrichable fields as checked when they change
  const enrichmentCheckedState = useMemo(() => {
    const initial: Record<string, boolean> = {};
    for (const f of enrichableFields) {
      initial[f.key] = enrichmentChecked[f.key] ?? true;
    }
    return initial;
  }, [enrichableFields, enrichmentChecked]);

  const [isEnrichmentUpdating, setIsEnrichmentUpdating] = useState(false);

  const handleEnrichmentUpdate = useCallback(async () => {
    if (!patient || !encounter) return;
    setIsEnrichmentUpdating(true);
    try {
      const updates: Record<string, string> = {};
      for (const field of enrichableFields) {
        if (enrichmentCheckedState[field.key]) {
          updates[field.key] = field.value;
        }
      }

      if (Object.keys(updates).length > 0) {
        await updatePatient({
          patientId: patient._id as Id<'patients'>,
          ...updates,
        });
      }

      await clearExtractedPatientInfo({
        encounterId: encounterId as Id<'encounters'>,
      });

      toast({
        title: 'Patient Updated',
        description: `Updated ${Object.keys(updates).length} field(s) from recording`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update patient',
        variant: 'destructive',
      });
    } finally {
      setIsEnrichmentUpdating(false);
    }
  }, [patient, encounter, enrichableFields, enrichmentCheckedState, updatePatient, clearExtractedPatientInfo, encounterId]);

  const handleEnrichmentDismiss = useCallback(async () => {
    try {
      await clearExtractedPatientInfo({
        encounterId: encounterId as Id<'encounters'>,
      });
    } catch (error) {
      console.error('Failed to dismiss enrichment:', error);
    }
  }, [clearExtractedPatientInfo, encounterId]);

  const handleDelete = async () => {
    try {
      const needsForce = status !== 'draft';
      await deleteDraft({
        encounterId: encounterId as Id<'encounters'>,
        forceDelete: needsForce || undefined,
      });
      toast({ title: 'Encounter deleted' });
      router.push('/encounter');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const handlePublish = useCallback(async () => {
    if (!user?.id) return;
    setIsPublishing(true);
    try {
      await publishConsultation({
        encounterId: encounterId as Id<'encounters'>,
        userId: user.id,
      });
      toast({
        title: 'Encounter Published',
        description: 'The record is now locked. The Patient Companion is now available to share with your patient.',
      });

      // Auto-update companion context if companion exists (non-blocking)
      if (detail?.companion) {
        updateSessionContext({ encounterId: encounterId as Id<'encounters'> }).catch((err) =>
          console.error('[Publish] Auto companion update error:', err)
        );
      }
    } catch (error) {
      toast({
        title: 'Error Publishing',
        description: error instanceof Error ? error.message : 'Failed to publish',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  }, [user?.id, publishConsultation, encounterId, detail?.companion, updateSessionContext]);

  const handleUnpublish = useCallback(async () => {
    setIsUnpublishing(true);
    try {
      await unpublishConsultationMut({
        encounterId: encounterId as Id<'encounters'>,
      });
      toast({
        title: 'Encounter Unpublished',
        description: 'The record is now editable again.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unpublish',
        variant: 'destructive',
      });
    } finally {
      setIsUnpublishing(false);
    }
  }, [unpublishConsultationMut, encounterId]);

  const handleCopyCompanionLink = useCallback(() => {
    const url = companionUrl || (detail?.companion ? `${window.location.origin}/companion/${detail.companion.accessToken}` : null);
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast({ title: 'Companion link copied' });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [companionUrl, detail?.companion]);

  // Compute facts from recordings for companion creation
  const computeFactsFromDetail = useCallback(() => {
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

  const hasFacts = factCount > 0;

  const unresolvedContradictions = useMemo(() => {
    if (!detail?.factReconciliation) return 0;
    return detail.factReconciliation.reconciledFacts.filter(
      f => f.status === 'contradicted' && !f.resolution
    ).length;
  }, [detail?.factReconciliation]);

  const handleResolveConflict = useCallback(async (factId: string, resolution: 'accept-new' | 'keep-old') => {
    try {
      await resolveFactConflict({
        encounterId: encounterId as Id<'encounters'>,
        factId,
        resolution,
      });
    } catch (err) {
      toast({ title: 'Failed to resolve conflict', variant: 'destructive' });
      console.error(err);
    }
  }, [resolveFactConflict, encounterId]);

  const handleSaveNote = async () => {
    if (!viewingNote || !editNoteText.trim()) return;
    setIsSavingNote(true);
    try {
      const noteIndex = viewingNote.index;
      await updateAddendum({ encounterId: encounterId as Id<'encounters'>, index: noteIndex, text: editNoteText.trim() });
      extractAndSaveNoteFacts(
        encounterId as Id<'encounters'>,
        editNoteText.trim(),
        createRecording,
        runReconciliation,
        (count) => setAddendumFactCount({ encounterId: encounterId as Id<'encounters'>, index: noteIndex, factCount: count }),
      );
      setViewingNote(null);
      toast({ title: 'Note updated' });
    } catch {
      toast({ title: 'Failed to update note', variant: 'destructive' });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleCreateCompanion = useCallback(async () => {
    if (!encounter || !patient || !detail?.recordings) return;
    setIsCreatingCompanion(true);
    try {
      const facts = computeFactsFromDetail();
      if (facts.length === 0) {
        toast({ title: 'No facts available', description: 'Record a encounter first.', variant: 'destructive' });
        return;
      }

      // Build documents from generated docs
      const docs = encounter.generatedDocuments;
      const documents: Record<string, { sections: Array<{ key: string; title: string; content: string }> }> = {};
      if (docs?.soapNote?.sections) documents.soapNote = { sections: docs.soapNote.sections };
      if (docs?.afterVisitSummary?.sections) documents.afterVisitSummary = { sections: docs.afterVisitSummary.sections };
      if (docs?.dischargeInstructions?.sections) documents.dischargeInstructions = { sections: docs.dischargeInstructions.sections };

      const chargedServices = encounter.invoiceMetadata?.lineItems?.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      }));

      const rawData = {
        facts,
        transcript: encounter.transcription,
        patientInfo: {
          name: patient.name,
          age: patient.age,
          weight: patient.weight,
        },
        documents: Object.keys(documents).length > 0 ? documents : undefined,
        clinicInfo: organization ? {
          clinicName: organization.clinicName,
          clinicPhone: organization.clinicPhone,
          emergencyPhone: organization.emergencyPhone,
        } : undefined,
        chargedServices: chargedServices && chargedServices.length > 0 ? chargedServices : undefined,
      };

      const res = await fetch('/api/companion/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId, rawData }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Failed (${res.status})`);
      }

      const data = await res.json();
      const url = data.shareableUrl || `${window.location.origin}/companion/${data.accessToken}`;
      setCompanionUrl(url);
      setShowCompanionModal(true);
    } catch (error) {
      console.error('[CreateCompanion] Error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create companion',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingCompanion(false);
    }
  }, [encounter, patient, detail?.recordings, computeFactsFromDetail, organization, encounterId]);

  const handleRefreshCompanion = useCallback(async () => {
    try {
      await updateSessionContext({ encounterId: encounterId as Id<'encounters'> });
      toast({ title: 'Companion updated', description: 'Patient companion context refreshed with latest data.' });
    } catch (error) {
      console.error('[RefreshCompanion] Error:', error);
      toast({ title: 'Error', description: 'Failed to refresh companion', variant: 'destructive' });
    }
  }, [updateSessionContext, encounterId]);

  const handleSendSms = useCallback(async () => {
    const url = companionUrl || (detail?.companion ? `${window.location.origin}/companion/${detail.companion.accessToken}` : null);
    if (!url || !smsPhone.trim()) return;
    setIsSendingSms(true);
    try {
      const res = await fetch('/api/companion/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: smsPhone.trim(),
          companionUrl: url,
          patientName: patient?.name,
          clinicName: organization?.clinicName,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      setSmsSent(true);
      toast({ title: 'SMS sent', description: `Companion link sent to ${smsPhone}` });
      setTimeout(() => setSmsSent(false), 4000);
    } catch (error) {
      toast({
        title: 'SMS failed',
        description: error instanceof Error ? error.message : 'Could not send SMS',
        variant: 'destructive',
      });
    } finally {
      setIsSendingSms(false);
    }
  }, [companionUrl, detail?.companion, smsPhone, patient?.name, organization?.clinicName]);

  // Auto-refresh companion context when documents are regenerated
  const lastGeneratedRef = useRef(encounter?.lastGeneratedAt);
  useEffect(() => {
    const prev = lastGeneratedRef.current;
    const curr = encounter?.lastGeneratedAt;
    lastGeneratedRef.current = curr;

    if (prev && curr && prev !== curr && detail?.companion) {
      updateSessionContext({ encounterId: encounterId as Id<'encounters'> }).catch((err) =>
        console.error('[AutoRefresh Companion] Error:', err)
      );
    }
  }, [encounter?.lastGeneratedAt, detail?.companion, updateSessionContext, encounterId]);

  if (encounter === undefined) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (encounter === null) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto p-6 text-center space-y-4">
          <p className="text-muted-foreground">Encounter not found</p>
          <AppLink href="/encounter">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Encounters
            </Button>
          </AppLink>
        </div>
      </Layout>
    );
  }

  const status = encounter.status || 'draft';
  const badge = statusConfig[status] || statusConfig.draft;
  const isEditable = status !== 'published';
  const hasRecordings = (detail?.recordings && detail.recordings.length > 0) || false;

  // Patient snapshot for header line 1
  const patientSnapshot = [
    patient?.age,
    patient?.sex,
    patient?.weight ? `${patient.weight}${patient.weightUnit ? ` ${patient.weightUnit}` : ''}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Card grid items
  const cards = [
    {
      title: 'Documents',
      icon: FileText,
      subtitle: docCount > 0 ? `${docCount} generated` : 'None yet — generate below',
      href: `/encounter/${encounterId}/documents`,
      hasContent: docCount > 0,
    },
    {
      title: 'Facts',
      icon: ClipboardList,
      subtitle: factCount > 0 ? `${factCount} captured` : 'Extracted from recordings',
      href: `/encounter/${encounterId}/facts`,
      hasContent: factCount > 0,
    },
    {
      title: 'Case Reasoning',
      icon: Stethoscope,
      subtitle: hasFacts ? 'Analyse findings with AI' : 'Available after recording',
      href: `/case-reasoning?encounterId=${encounterId}`,
      hasContent: hasFacts,
    },
  ];

  return (
    <Layout>
      <BillingGuard feature="Encounters">
        <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-5">
          {/* Header: back + name + status + actions */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <AppLink
                href="/encounter"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Encounters
              </AppLink>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold">
                  {patient?.name || 'No patient linked'}
                </h1>
                <Badge variant="outline" className={`text-xs ${badge.className}`}>
                  {badge.label}
                </Badge>
              </div>
              {encounter.reasonForVisit && (
                <p className="text-sm font-medium text-foreground/80">
                  {encounter.reasonForVisit}
                </p>
              )}
              {patientSnapshot && (
                <p className="text-sm text-muted-foreground">
                  {patientSnapshot}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>{formatRelativeDate(encounter.createdAt)}</span>
                {encounter.publishedAt && (
                  <span>· Published {formatRelativeDate(encounter.publishedAt)}</span>
                )}
              </div>
            </div>

            {/* Primary actions */}
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
              {status === 'draft' && (
                <>
                  <AppLink href={`/encounter/new?encounterId=${encounterId}`}>
                    <Button className="gap-2">
                      <Mic className="h-4 w-4" />
                      Ambient
                    </Button>
                  </AppLink>
                  <AppLink href={`/encounter/new?encounterId=${encounterId}&mode=dictate`}>
                    <Button variant="outline" className="gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Dictate
                    </Button>
                  </AppLink>
                </>
              )}

              {(status === 'in-progress' || status === 'review') && (
                <>
                  <DictationModal encounterId={encounterId as Id<'encounters'>} />
                  <AppLink href={`/encounter/new?encounterId=${encounterId}`}>
                    <Button variant="outline" className="gap-2">
                      <Mic className="h-4 w-4" />
                      Ambient Consultation
                    </Button>
                  </AppLink>
                  <Button
                    className="gap-2"
                    onClick={() => setShowPublishConfirm(true)}
                    disabled={isPublishing}
                  >
                    {isPublishing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Publish
                  </Button>
                </>
              )}

              {status === 'published' && (
                <>
                  <DictationModal encounterId={encounterId as Id<'encounters'>} />
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setShowAddendum(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Addendum
                  </Button>
                  {hasFacts && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => setShowCompanionModal(true)}
                    >
                      <Heart className="h-4 w-4" />
                      Patient Companion
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleUnpublish}
                    disabled={isUnpublishing}
                  >
                    {isUnpublishing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Unpublish
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Conflict resolution banner — shown whenever there are unresolved contradictions */}
          {unresolvedContradictions > 0 && (
            <div className="rounded-lg border-2 border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-4 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  {unresolvedContradictions} conflicting fact{unresolvedContradictions !== 1 ? 's' : ''} must be resolved
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                  Medical coding and document generation are blocked until all conflicts are resolved.
                </p>
              </div>
              <AppLink
                href={`/encounter/${encounterId}/facts`}
                className="flex-shrink-0 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
              >
                Resolve now →
              </AppLink>
            </div>
          )}

          {/* Draft empty state */}
          {status === 'draft' && !hasRecordings && (
            <div className="space-y-4">
              {patient && (
                <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium">{patient.name}</span>
                  {patientSnapshot && <span className="text-sm text-muted-foreground">· {patientSnapshot}</span>}
                  <AppLink href={`/patient-records/${patient._id}`} className="ml-auto text-xs text-primary hover:underline flex items-center gap-0.5 flex-shrink-0">
                    Record <ChevronRight className="h-3 w-3" />
                  </AppLink>
                </div>
              )}
              <div className="flex flex-col items-center justify-center py-16 space-y-4 rounded-lg border bg-card">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mic className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-medium">Ready to begin</p>
                  <p className="text-sm text-muted-foreground">Choose how to capture this encounter</p>
                </div>
                <div className="flex items-center gap-3">
                  <AppLink href={`/encounter/new?encounterId=${encounterId}`}>
                    <Button className="gap-2"><Mic className="h-4 w-4" />Ambient Consultation</Button>
                  </AppLink>
                  <AppLink href={`/encounter/new?encounterId=${encounterId}&mode=dictate`}>
                    <Button variant="outline" className="gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Dictate Note
                    </Button>
                  </AppLink>
                </div>
              </div>
            </div>
          )}

          {/* Main content — visible once encounter has recordings */}
          {hasRecordings && (
            <div className="space-y-5">

              {/* ── Full-width navigation cards ──────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cards.map((card) => {
                  const CardIcon = card.icon;
                  return (
                    <AppLink
                      key={card.title}
                      href={card.href}
                      className="group rounded-lg border bg-card p-4 flex items-center gap-4 transition-colors hover:bg-muted/50 hover:border-primary/30"
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        card.hasContent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        <CardIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium group-hover:text-primary transition-colors">{card.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </AppLink>
                  );
                })}
              </div>

              {/* Patient enrichment banner */}
              {isEditable && enrichableFields.length > 0 && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="text-sm font-medium">New patient info detected from recording</p>
                    </div>
                    <button onClick={handleEnrichmentDismiss} className="text-muted-foreground hover:text-foreground p-0.5">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {enrichableFields.map((field) => (
                      <label key={field.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={enrichmentCheckedState[field.key] ?? true}
                          onCheckedChange={(checked) => setEnrichmentChecked((prev) => ({ ...prev, [field.key]: !!checked }))}
                        />
                        <span className="text-muted-foreground">{field.label}:</span>
                        <span className="font-medium">{field.value}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleEnrichmentUpdate}
                      disabled={isEnrichmentUpdating || !Object.values(enrichmentCheckedState).some(Boolean)}>
                      {isEnrichmentUpdating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                      Update Patient
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleEnrichmentDismiss}>Dismiss</Button>
                  </div>
                </div>
              )}

              {/* ── Single-column body ───────────────────────────────── */}
              <div className="space-y-5">

                {/* Recording Timeline */}
                <div ref={timelineRef}>
                  <RecordingTimeline
                    recordings={detail?.recordings || []}
                    factReconciliation={detail?.factReconciliation}
                    onResolveConflict={isEditable ? handleResolveConflict : undefined}
                    addenda={encounter.addenda ?? []}
                    onEditNote={(index, text, createdAt) => { setViewingNote({ index, text, createdAt }); setEditNoteText(text); }}
                    isEditable={isEditable}
                  />
                </div>

                {/* Planned Services */}
                {orgContext?.orgId && (
                  <PlannedServicesWidget
                    encounterId={encounterId as Id<"encounters">}
                    orgId={orgContext.orgId as Id<"organizations">}
                    facts={computeFactsFromDetail()}
                    encounterType={(encounter.encounterType as 'outpatient' | 'inpatient' | 'ed') ?? 'outpatient'}
                  />
                )}

                {/* Medical Coding — collapsible summary */}
                {(() => {
                  const icd10 = encounter.icd10Codes ?? [];
                  const cpt = encounter.cptCodes ?? [];
                  const hasCodes = icd10.length > 0 || cpt.length > 0;
                  return (
                    <>
                      {/* Collapsed: one-line summary bar */}
                      {!codingExpanded && (
                        <button
                          onClick={() => setCodingExpanded(true)}
                          className="w-full rounded-lg border bg-card px-4 py-3 flex items-center gap-2.5 hover:bg-muted/40 transition-colors text-left"
                        >
                          <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0">Medical Coding</span>
                          {hasCodes ? (
                            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                              {icd10.map(code => (
                                <span key={code} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                                  {code}
                                </span>
                              ))}
                              {cpt.map(code => (
                                <span key={code} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                                  {code}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground flex-1">No codes yet</span>
                          )}
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        </button>
                      )}

                      {/* Expanded: full coding panel, always mounted to preserve state */}
                      <div className={codingExpanded ? '' : 'hidden'}>
                        <div className="rounded-lg border bg-card overflow-hidden">
                          <button
                            onClick={() => setCodingExpanded(false)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left border-b border-border"
                          >
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <Tag className="h-3.5 w-3.5" />
                              Medical Coding
                            </span>
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground rotate-180" />
                          </button>
                          <div className="p-4">
                            <MedicalCodingPanel
                              encounterId={encounterId as Id<'encounters'>}
                              facts={computeFactsFromDetail()}
                              transcript={encounter.transcription}
                              existingIcd10={icd10}
                              existingCpt={cpt}
                              isEditable={isEditable}
                              addenda={encounter.addenda ?? []}
                              encounterType={(encounter.encounterType as 'outpatient' | 'inpatient' | 'ed') ?? 'outpatient'}
                              reconciledAt={detail?.factReconciliation?.reconciledAt}
                              unresolvedContradictions={unresolvedContradictions}
                              embedded
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Attachments */}
                <div
                  className="rounded-lg border bg-card p-3"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attachments</p>
                      {evidenceFiles && evidenceFiles.length > 0 && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{evidenceFiles.length}</span>
                      )}
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Attach
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden"
                      accept="application/pdf,image/jpeg,image/png,image/webp" multiple
                      onChange={(e) => handleFileUpload(e.target.files)} />
                  </div>
                  {evidenceFiles === undefined ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : evidenceFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">No attachments — drag and drop or click Attach</p>
                  ) : (
                    <div className="divide-y">
                      {evidenceFiles.map((file) => (
                        <div key={file._id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs flex-1 truncate">{file.fileName}</span>
                          {file.url && (
                            <button onClick={() => window.open(file.url!, '_blank')}
                              className="text-muted-foreground hover:text-foreground transition-colors">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteFile(file._id)}
                            className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delete */}
                {(status === 'draft' || isAdmin) && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete encounter
                    </button>
                  </div>
                )}

              </div>{/* end single-column body */}

            </div>
          )}{/* end main content */}

        </div>

        {/* Note view / edit modal */}
        <Dialog open={!!viewingNote} onOpenChange={(o) => { if (!o) setViewingNote(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Note
              </DialogTitle>
            </DialogHeader>
            {viewingNote && (
              <div className="space-y-4 pt-1">
                <p className="text-xs text-muted-foreground">{new Date(viewingNote.createdAt).toLocaleString()}</p>
                {isEditable ? (
                  <textarea
                    className="w-full min-h-[220px] text-sm leading-relaxed bg-transparent resize-none outline-none focus:outline-none border rounded-md p-3 font-mono"
                    value={editNoteText}
                    onChange={(e) => setEditNoteText(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap min-h-[80px] rounded-md border bg-muted/30 p-3">
                    {viewingNote.text}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setViewingNote(null)}>
                    {isEditable ? 'Cancel' : 'Close'}
                  </Button>
                  {isEditable && (
                    <Button size="sm" onClick={handleSaveNote} disabled={isSavingNote || !editNoteText.trim()}>
                      {isSavingNote && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                      Save Note
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Encounter?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this encounter
                {patient?.name ? ` for ${patient.name}` : ''} and all associated recordings, attachments, companion sessions, and follow-ups.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Publish confirmation */}
        <AlertDialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Publish Encounter?</AlertDialogTitle>
              <AlertDialogDescription>
                This will lock the record{patient?.name ? ` for ${patient.name}` : ''}. Only addenda can be added after publishing.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handlePublish}>
                Publish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Patient Companion Modal */}
        <Dialog open={showCompanionModal} onOpenChange={setShowCompanionModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-600" />
                Patient Companion
              </DialogTitle>
            </DialogHeader>
            {(companionUrl || detail?.companion) ? (
              <div className="flex flex-col items-center gap-4 py-2">
                <div className="rounded-2xl bg-white p-4 shadow-sm border">
                  <QRCodeSVG
                    value={companionUrl || (detail?.companion ? `${typeof window !== 'undefined' ? window.location.origin : ''}/companion/${detail.companion.accessToken}` : '')}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Share this code for {patient?.name ? `${patient.name}'s` : 'the patient\'s'} care companion.
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleCopyCompanionLink}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy Link'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleRefreshCompanion}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                  <a
                    href={companionUrl || (detail?.companion ? `/companion/${detail.companion.accessToken}` : '#')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  </a>
                </div>
                {/* Send via SMS */}
                <div className="w-full border-t pt-3 mt-1">
                  <p className="text-xs text-muted-foreground text-center mb-2 flex items-center justify-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Send link directly to patient&apos;s phone
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      placeholder="Patient mobile number"
                      value={smsPhone}
                      onChange={(e) => setSmsPhone(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendSms(); }}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 flex-shrink-0"
                      onClick={handleSendSms}
                      disabled={isSendingSms || !smsPhone.trim()}
                    >
                      {isSendingSms ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : smsSent ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Phone className="h-3.5 w-3.5" />
                      )}
                      {smsSent ? 'Sent' : 'Send'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="h-16 w-16 rounded-full bg-pink-50 flex items-center justify-center">
                  <Heart className="h-8 w-8 text-pink-300" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Share with the patient</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Create a shareable AI companion that helps the patient understand encounter findings and care instructions.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={handleCreateCompanion}
                  disabled={isCreatingCompanion}
                >
                  {isCreatingCompanion ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart className="h-4 w-4" />
                  )}
                  Create Companion
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Addendum Dialog */}
        <AddAddendumDialog
          open={showAddendum}
          onOpenChange={setShowAddendum}
          encounterId={encounterId}
        />
      </BillingGuard>
    </Layout>
  );
}
