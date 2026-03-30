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
  Pencil,
  Upload,
  RefreshCw,
  RotateCcw,
  Stethoscope,
  User,
  Mail,
  Phone,
  Weight,
  Heart,
  MessageSquare,
  ExternalLink,
  FileText,
  ClipboardList,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AppLink } from '@/components/navigation/AppLink';
import { toast } from '@/hooks/use-toast';

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
  // Inline edit state for patient fields
  const [editingPatientField, setEditingPatientField] = useState<string | null>(null);
  const [editPatientValue, setEditPatientValue] = useState('');


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

  const deleteDraft = useMutation(api.encounters.deleteDraftConsultation);
  const publishConsultation = useMutation(api.encounters.publishConsultation);
  const unpublishConsultationMut = useMutation(api.encounters.unpublishConsultation);
  const updateSessionContext = useMutation(api.companions.updateSessionContext);
  const updatePatient = useMutation(api.patients.updatePatient);
  const clearExtractedPatientInfo = useMutation(api.encounters.clearExtractedPatientInfo);
  const resolveFactConflict = useMutation(api.encounters.resolveFactConflict);

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
        description: 'The record is now locked. Only addenda can be added.',
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

  const startPatientEdit = (field: string, currentValue: string) => {
    setEditingPatientField(field);
    setEditPatientValue(currentValue);
  };

  const cancelPatientEdit = () => {
    setEditingPatientField(null);
    setEditPatientValue('');
  };

  const savePatientEdit = async () => {
    if (!editingPatientField || !patient) return;
    const trimmed = editPatientValue.trim();
    const currentValue = (patient as Record<string, unknown>)[editingPatientField] as string || '';
    if (trimmed === currentValue) { cancelPatientEdit(); return; }

    try {
      await updatePatient({
        patientId: patient._id as Id<'patients'>,
        [editingPatientField]: trimmed || undefined,
      });
      toast({ title: 'Patient updated' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save.', variant: 'destructive' });
    }
    cancelPatientEdit();
  };

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
        <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-5">
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
                      Begin Encounter
                    </Button>
                  </AppLink>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}

              {(status === 'in-progress' || status === 'review') && (
                <>
                  <DictationModal encounterId={encounterId as Id<'encounters'>} />
                  <AppLink href={`/encounter/new?encounterId=${encounterId}`}>
                    <Button variant="outline" className="gap-2">
                      <Mic className="h-4 w-4" />
                      Add Recording
                    </Button>
                  </AppLink>
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
                  {isAdmin && (
                    <Button
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
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
                  {isAdmin && (
                    <Button
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Conflict resolution banner — shown whenever there are unresolved contradictions */}
          {unresolvedContradictions > 0 && (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-500 p-4 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {unresolvedContradictions} conflicting fact{unresolvedContradictions !== 1 ? 's' : ''} need your review
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  Recordings contain contradictory information. Resolve each conflict before medical codes can be generated or documents created.
                </p>
              </div>
              <button
                onClick={() => timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="flex-shrink-0 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-200/60 hover:bg-amber-200 dark:bg-amber-800/40 dark:hover:bg-amber-800/60 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
              >
                Resolve now →
              </button>
            </div>
          )}

          {/* Patient Details */}
          {patient && (
            <div className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Patient</p>
                <AppLink
                  href={`/patient-records/${patient._id}`}
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                  Full record <ChevronRight className="h-3 w-3" />
                </AppLink>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                {[
                  { field: 'age', label: 'Age', icon: null, value: patient.age },
                  { field: 'sex', label: 'Sex', icon: null, value: patient.sex },
                  { field: 'weight', label: 'Weight', icon: Weight, value: patient.weight ? `${patient.weight}${patient.weightUnit ? ` ${patient.weightUnit}` : ''}` : undefined },
                ].map(({ field, label, icon: Icon, value }) => (
                  <div key={field} className="group">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      {Icon && <Icon className="h-3 w-3" />}
                      {label}
                    </p>
                    {editingPatientField === field ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editPatientValue}
                          onChange={(e) => setEditPatientValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') savePatientEdit();
                            if (e.key === 'Escape') cancelPatientEdit();
                          }}
                          onBlur={savePatientEdit}
                          className="h-6 text-sm w-full"
                        />
                      </div>
                    ) : isEditable ? (
                      <p
                        className={`text-sm cursor-pointer flex items-center gap-1 ${value ? '' : 'text-muted-foreground/40 italic'}`}
                        onClick={() => startPatientEdit(field, field === 'weight' ? (patient.weight || '') : (value || ''))}
                      >
                        <span className="truncate">{value || `Add`}</span>
                        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground flex-shrink-0" />
                      </p>
                    ) : (
                      <p className={`text-sm ${value ? '' : 'text-muted-foreground/40 italic'}`}>
                        <span className="truncate">{value || '—'}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Patient Enrichment Banner (hidden when published) */}
          {isEditable && enrichableFields.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                  <p className="text-sm font-medium">
                    New patient info detected from recording
                  </p>
                </div>
                <button
                  onClick={handleEnrichmentDismiss}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {enrichableFields.map((field) => (
                  <label
                    key={field.key}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={enrichmentCheckedState[field.key] ?? true}
                      onCheckedChange={(checked) =>
                        setEnrichmentChecked((prev) => ({
                          ...prev,
                          [field.key]: !!checked,
                        }))
                      }
                    />
                    <span className="text-muted-foreground">{field.label}:</span>
                    <span className="font-medium">{field.value}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleEnrichmentUpdate}
                  disabled={isEnrichmentUpdating || !Object.values(enrichmentCheckedState).some(Boolean)}
                >
                  {isEnrichmentUpdating ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Update Patient
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleEnrichmentDismiss}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Draft empty state */}
          {status === 'draft' && !hasRecordings && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 rounded-lg border bg-card">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mic className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-medium">Ready to begin</p>
                <p className="text-sm text-muted-foreground">
                  Start a recording to capture encounter findings
                </p>
              </div>
              <AppLink href={`/encounter/new?encounterId=${encounterId}`}>
                <Button className="gap-2">
                  <Mic className="h-4 w-4" />
                  Begin Encounter
                </Button>
              </AppLink>
            </div>
          )}

          {/* Two-column layout once encounter has content */}
          {hasRecordings && (
            <div className="flex gap-6 items-start">

              {/* ── Left: clinical ─────────────────────────────────── */}
              <div className="flex-1 min-w-0 space-y-5">

                {/* Card Grid — command centre */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">
                            {card.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {card.subtitle}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </AppLink>
                    );
                  })}
                </div>

                {/* Recording Timeline */}
                <div ref={timelineRef}>
                  <RecordingTimeline
                    recordings={detail?.recordings || []}
                    factReconciliation={detail?.factReconciliation}
                    onResolveConflict={isEditable ? handleResolveConflict : undefined}
                  />
                </div>

                {/* Attachments */}
                <div
                  className="rounded-lg border bg-card p-4"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attachments</p>
                      {evidenceFiles && evidenceFiles.length > 0 && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {evidenceFiles.length}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Attach file
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                  </div>

                  {evidenceFiles === undefined ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : evidenceFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      No attachments — drag and drop or click &quot;Attach file&quot; above
                    </p>
                  ) : (
                    <div className="divide-y">
                      {evidenceFiles.map((file) => (
                        <div key={file._id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm flex-1 truncate">{file.fileName}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {file.fileSize < 1024 * 1024
                              ? `${(file.fileSize / 1024).toFixed(1)} KB`
                              : `${(file.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                          </span>
                          {file.url && (
                            <button
                              onClick={() => window.open(file.url!, '_blank')}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Open"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteFile(file._id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Notes / Addenda */}
                {encounter?.addenda && encounter.addenda.length > 0 && (
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Notes
                    </p>
                    <div className="space-y-2">
                      {encounter.addenda.map((note, i) => (
                        <div key={i} className="text-sm space-y-0.5">
                          <div className="space-y-0.5">
                            {note.text.split('\n').map((line, j) => {
                              const bullet = line.match(/^-\s+(.+)/);
                              const numbered = line.match(/^(\d+)\.\s+(.+)/);
                              if (bullet) return (
                                <div key={j} className="flex items-start gap-2">
                                  <span className="text-primary font-bold mt-0.5 flex-shrink-0">•</span>
                                  <span>{bullet[1]}</span>
                                </div>
                              );
                              if (numbered) return (
                                <div key={j} className="flex items-start gap-2">
                                  <span className="text-primary font-medium mt-0.5 flex-shrink-0 min-w-[1.2rem]">{numbered[1]}.</span>
                                  <span>{numbered[2]}</span>
                                </div>
                              );
                              return line ? <p key={j}>{line}</p> : null;
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(note.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>{/* end left column */}

              {/* ── Right: billing sidebar ──────────────────────────── */}
              <div className="w-80 flex-shrink-0 space-y-4 sticky top-6 self-start">
                {orgContext?.orgId && (
                  <PlannedServicesWidget
                    encounterId={encounterId as Id<"encounters">}
                    orgId={orgContext.orgId as Id<"organizations">}
                    facts={computeFactsFromDetail()}
                    encounterType={(encounter.encounterType as 'outpatient' | 'inpatient' | 'ed') ?? 'outpatient'}
                  />
                )}
                <MedicalCodingPanel
                  encounterId={encounterId as Id<'encounters'>}
                  facts={computeFactsFromDetail()}
                  transcript={encounter.transcription}
                  existingIcd10={encounter.icd10Codes ?? []}
                  existingCpt={encounter.cptCodes ?? []}
                  isEditable={isEditable}
                  addenda={encounter.addenda ?? []}
                  encounterType={(encounter.encounterType as 'outpatient' | 'inpatient' | 'ed') ?? 'outpatient'}
                  reconciledAt={detail?.factReconciliation?.reconciledAt}
                  unresolvedContradictions={unresolvedContradictions}
                />
              </div>{/* end right sidebar */}

            </div>
          )}{/* end two-column */}

        </div>

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
