'use client';

import { useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  FlaskConical,
  Plus,
  Loader2,
  RotateCw,
  Send,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface LabResult {
  _id: Id<'labResults'>;
  testName: string;
  resultValue: string;
  referenceRange?: string;
  units?: string;
  urgency?: string;
  urgencyReason?: string;
  triageStatus: string;
  patientNotificationDraft?: string;
  suggestedFollowUp?: string;
  notificationSent?: boolean;
  followUpAccepted?: boolean;
  resultedAt: string;
}

interface ResultsTriagePanelProps {
  encounterId: Id<'encounters'>;
  patientId: Id<'patients'>;
  orgId: Id<'organizations'>;
  providerId: string;
  patientPhone?: string;
  isEditable?: boolean;
}

const URGENCY_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  badgeClass: string;
  borderClass: string;
}> = {
  critical: {
    label: 'Critical',
    icon: AlertTriangle,
    badgeClass: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700',
    borderClass: 'border-l-red-500',
  },
  high: {
    label: 'Abnormal',
    icon: AlertCircle,
    badgeClass: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700',
    borderClass: 'border-l-amber-400',
  },
  normal: {
    label: 'Normal',
    icon: CheckCircle2,
    badgeClass: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800',
    borderClass: 'border-l-green-400',
  },
  low: {
    label: 'Monitor',
    icon: Info,
    badgeClass: 'bg-gray-100 dark:bg-muted/40 text-gray-600 dark:text-muted-foreground border-gray-300 dark:border-border',
    borderClass: 'border-l-gray-300',
  },
};

function getUrgencyConfig(urgency?: string) {
  return URGENCY_CONFIG[urgency ?? ''] ?? {
    label: 'Pending',
    icon: Loader2,
    badgeClass: 'bg-gray-100 dark:bg-muted/40 text-gray-500 dark:text-muted-foreground border-gray-200 dark:border-border',
    borderClass: 'border-l-gray-200',
  };
}

function AddResultForm({
  encounterId,
  patientId,
  orgId,
  providerId,
  onClose,
}: {
  encounterId: Id<'encounters'>;
  patientId: Id<'patients'>;
  orgId: Id<'organizations'>;
  providerId: string;
  onClose: () => void;
}) {
  const [testName, setTestName] = useState('');
  const [resultValue, setResultValue] = useState('');
  const [referenceRange, setReferenceRange] = useState('');
  const [units, setUnits] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const createLabResult = useMutation(api.resultsTriage.createLabResult);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!testName.trim() || !resultValue.trim()) return;

    setIsSaving(true);
    try {
      await createLabResult({
        encounterId,
        patientId,
        orgId,
        providerId,
        testName: testName.trim(),
        resultValue: resultValue.trim(),
        referenceRange: referenceRange.trim() || undefined,
        units: units.trim() || undefined,
        entryMethod: 'manual',
      });
      toast({ title: 'Result added — AI triage starting…' });
      onClose();
    } catch {
      toast({ title: 'Failed to add result', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-xs text-gray-500 dark:text-muted-foreground mb-1 block">Test name *</label>
          <Input
            value={testName}
            onChange={e => setTestName(e.target.value)}
            placeholder="e.g. HbA1c, CBC, TSH"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-muted-foreground mb-1 block">Result *</label>
          <Input
            value={resultValue}
            onChange={e => setResultValue(e.target.value)}
            placeholder="e.g. 8.2%"
            required
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-muted-foreground mb-1 block">Units</label>
          <Input
            value={units}
            onChange={e => setUnits(e.target.value)}
            placeholder="e.g. %  mg/dL  K/uL"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 dark:text-muted-foreground mb-1 block">Reference range</label>
          <Input
            value={referenceRange}
            onChange={e => setReferenceRange(e.target.value)}
            placeholder="e.g. 4.0–6.0%"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Add & Triage
        </Button>
      </div>
    </form>
  );
}

function NotificationModal({
  result,
  patientPhone,
  onClose,
}: {
  result: LabResult;
  patientPhone?: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(result.patientNotificationDraft ?? '');
  const [isSending, setIsSending] = useState(false);

  const approveNotification = useMutation(api.resultsTriage.approveNotification);

  async function handleSend() {
    if (!draft.trim()) return;
    setIsSending(true);
    try {
      if (patientPhone) {
        await fetch('/api/companion/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toPhone: patientPhone,
            companionUrl: '',
            patientName: undefined,
          }),
        });
      }
      await approveNotification({ labResultId: result._id });
      toast({ title: 'Notification sent' });
      onClose();
    } catch {
      toast({ title: 'Failed to send notification', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  }

  async function handleMarkSent() {
    try {
      await approveNotification({ labResultId: result._id });
      toast({ title: 'Marked as notified' });
      onClose();
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-500 dark:text-muted-foreground mb-1.5 block font-medium">Notification draft</label>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="w-full rounded-md border border-gray-200 dark:border-border bg-transparent dark:text-foreground p-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
          rows={4}
        />
      </div>
      {result.suggestedFollowUp && (
        <div className="rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 p-3">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1">Suggested follow-up</p>
          <p className="text-sm text-indigo-800 dark:text-indigo-300">{result.suggestedFollowUp}</p>
        </div>
      )}
      <div className="flex gap-2 justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleMarkSent}>
            <Check className="h-3.5 w-3.5 mr-1" />
            Mark notified
          </Button>
          {patientPhone && (
            <Button size="sm" disabled={isSending} onClick={handleSend}>
              {isSending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                : <Send className="h-3.5 w-3.5 mr-1" />}
              Send SMS
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  patientPhone,
  isEditable,
}: {
  result: LabResult;
  patientPhone?: string;
  isEditable: boolean;
}) {
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const urgencyCfg = getUrgencyConfig(result.urgency);
  const UrgencyIcon = urgencyCfg.icon;
  const isPending = result.triageStatus === 'pending';
  const isTriaged = result.triageStatus === 'triaged' || result.triageStatus === 'reviewed';

  const acceptFollowUp = useMutation(api.resultsTriage.acceptFollowUp);
  const markReviewed = useMutation(api.resultsTriage.markReviewed);

  async function handleAcceptFollowUp() {
    try {
      await acceptFollowUp({ labResultId: result._id });
      toast({ title: 'Follow-up noted' });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  }

  async function handleMarkReviewed() {
    try {
      await markReviewed({ labResultId: result._id });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  }

  return (
    <>
      <div className={`border-l-4 ${urgencyCfg.borderClass} pl-3 py-2 pr-2`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-800 dark:text-foreground">{result.testName}</span>
              <span className="text-sm text-gray-700 dark:text-foreground">{result.resultValue}{result.units ? ` ${result.units}` : ''}</span>
              {result.referenceRange && (
                <span className="text-xs text-gray-400 dark:text-muted-foreground">ref: {result.referenceRange}</span>
              )}
              {isPending ? (
                <Badge variant="outline" className="text-xs gap-1 text-gray-400 dark:text-muted-foreground">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Analyzing…
                </Badge>
              ) : (
                <Badge variant="outline" className={`text-xs gap-1 border ${urgencyCfg.badgeClass}`}>
                  <UrgencyIcon className="h-2.5 w-2.5" />
                  {urgencyCfg.label}
                </Badge>
              )}
              {result.notificationSent && (
                <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40">
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                  Notified
                </Badge>
              )}
            </div>

            {result.urgencyReason && (
              <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">{result.urgencyReason}</p>
            )}

            {isTriaged && !result.notificationSent && result.patientNotificationDraft && isEditable && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setShowNotifyModal(true)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  <Send className="h-3 w-3" />
                  Review & send notification
                </button>
                {isTriaged && isEditable && (
                  <button
                    onClick={handleMarkReviewed}
                    className="text-xs text-gray-400 dark:text-muted-foreground hover:text-gray-600"
                  >
                    Mark reviewed
                  </button>
                )}
              </div>
            )}

            {isTriaged && result.suggestedFollowUp && !result.followUpAccepted && isEditable && (
              <div className="mt-1.5 flex items-start gap-2 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 px-2 py-1.5">
                <p className="text-xs text-indigo-800 dark:text-indigo-300 flex-1">
                  <span className="font-medium">Suggested: </span>{result.suggestedFollowUp}
                </p>
                <button
                  onClick={handleAcceptFollowUp}
                  className="shrink-0 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {result.followUpAccepted && result.suggestedFollowUp && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                <Check className="inline h-3 w-3 mr-0.5" />
                Follow-up noted: {result.suggestedFollowUp}
              </p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showNotifyModal} onOpenChange={setShowNotifyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notify Patient — {result.testName}</DialogTitle>
          </DialogHeader>
          <NotificationModal
            result={result}
            patientPhone={patientPhone}
            onClose={() => setShowNotifyModal(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ResultsTriagePanel({
  encounterId,
  patientId,
  orgId,
  providerId,
  patientPhone,
  isEditable = true,
}: ResultsTriagePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);

  const rerunExtraction = useAction(api.resultsTriage.extractLabResultsFromConsultation);

  async function handleRerun() {
    if (isRerunning) return;
    setIsRerunning(true);
    try {
      const result = await rerunExtraction({ encounterId });
      if (!result.success) {
        toast({ title: 'Extraction failed', description: result.error, variant: 'destructive' });
      } else if ((result.count ?? 0) === 0) {
        toast({ title: 'No lab results found in this consultation' });
      } else {
        toast({ title: `Found ${result.count} lab result${result.count !== 1 ? 's' : ''}` });
      }
    } catch {
      toast({ title: 'Extraction failed', variant: 'destructive' });
    } finally {
      setIsRerunning(false);
    }
  }

  const results = useQuery(api.resultsTriage.getResultsByEncounter, { encounterId }) ?? [];

  const pendingCount = results.filter(r => r.triageStatus === 'pending').length;
  const criticalCount = results.filter(r => r.urgency === 'critical').length;
  const unreviewedCount = results.filter(r => r.triageStatus === 'triaged').length;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setIsCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-foreground">Lab Results</span>
          {results.length > 0 && (
            <div className="flex items-center gap-1">
              {criticalCount > 0 && (
                <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700">
                  {criticalCount} critical
                </Badge>
              )}
              {unreviewedCount > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                  {unreviewedCount} to review
                </Badge>
              )}
              {criticalCount === 0 && unreviewedCount === 0 && (
                <Badge variant="outline" className="text-xs">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <button
              onClick={e => { e.stopPropagation(); handleRerun(); }}
              disabled={isRerunning}
              className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:hover:text-foreground disabled:opacity-40 transition-colors"
              title="Re-extract lab results from consultation"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isRerunning ? 'animate-spin' : ''}`} />
            </button>
          )}
          {isEditable && (
            <button
              onClick={e => { e.stopPropagation(); setShowAddForm(f => !f); setIsCollapsed(false); }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add result
            </button>
          )}
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-gray-400 dark:text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-400 dark:text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="border-t border-gray-100 dark:border-border">
          {/* Add result form */}
          {showAddForm && (
            <div className="px-4 py-3 border-b border-gray-100 dark:border-border bg-gray-50 dark:bg-muted/40">
              <AddResultForm
                encounterId={encounterId}
                patientId={patientId}
                orgId={orgId}
                providerId={providerId}
                onClose={() => setShowAddForm(false)}
              />
            </div>
          )}

          {/* Results list */}
          {results.length === 0 && !showAddForm && (
            <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-muted-foreground">
              Results are extracted automatically from the consultation.
              {isEditable && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="ml-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Add manually
                </button>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="px-4 py-3 space-y-3">
              {results.map(result => (
                <ResultCard
                  key={result._id}
                  result={result as LabResult}
                  patientPhone={patientPhone}
                  isEditable={isEditable}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
