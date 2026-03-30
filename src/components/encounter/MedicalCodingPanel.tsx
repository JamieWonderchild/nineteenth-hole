'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  Sparkles,
  Check,
  X,
  Tag,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface MedicalCode {
  code: string;
  system: 'ICD-10-CM' | 'ICD-10-PCS' | 'CPT';
  description: string;
  confidence: number;
  evidences?: Array<{ text: string; start: number; end: number }>;
}

interface MedicalCodingPanelProps {
  encounterId: Id<'encounters'>;
  facts: Array<{ id: string; text: string; group: string }>;
  transcript?: string;
  existingIcd10?: string[];
  existingCpt?: string[];
  isEditable?: boolean;
  addenda?: Array<{ text: string; createdAt: string }>;
}

export function MedicalCodingPanel({
  encounterId,
  facts,
  transcript,
  existingIcd10 = [],
  existingCpt = [],
  isEditable = true,
  addenda = [],
}: MedicalCodingPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [icd10Suggestions, setIcd10Suggestions] = useState<MedicalCode[]>([]);
  const [cptSuggestions, setCptSuggestions] = useState<MedicalCode[]>([]);
  // Accepted sets — pre-populated from DB on mount
  const [acceptedIcd10, setAcceptedIcd10] = useState<Set<string>>(new Set(existingIcd10));
  const [acceptedCpt, setAcceptedCpt] = useState<Set<string>>(new Set(existingCpt));
  const [hasRun, setHasRun] = useState(existingIcd10.length > 0 || existingCpt.length > 0);
  const autoTriggered = useRef(false);

  const updateMedicalCodes = useMutation(api.encounters.updateMedicalCodes);

  const runCoding = useCallback(async () => {
    if (facts.length === 0) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/corti/predict-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts, transcript }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      const icd10: MedicalCode[] = data.icd10 ?? [];
      const cpt: MedicalCode[] = data.cpt ?? [];
      setIcd10Suggestions(icd10);
      setCptSuggestions(cpt);
      // Pre-accept ALL returned codes — doctor deselects rather than selects
      const newIcd10 = new Set([...existingIcd10, ...icd10.map((c) => c.code)]);
      const newCpt = new Set([...existingCpt, ...cpt.map((c) => c.code)]);
      setAcceptedIcd10(newIcd10);
      setAcceptedCpt(newCpt);
      setHasRun(true);
    } catch (error) {
      toast({
        title: 'Coding failed',
        description: error instanceof Error ? error.message : 'Could not predict codes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [facts, transcript, existingIcd10, existingCpt]);

  // Auto-trigger when facts first arrive and no codes have been saved yet
  useEffect(() => {
    if (
      !autoTriggered.current &&
      facts.length > 0 &&
      existingIcd10.length === 0 &&
      existingCpt.length === 0 &&
      isEditable
    ) {
      autoTriggered.current = true;
      runCoding();
    }
  }, [facts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-run coding when new addenda (dictated notes) are saved
  const processedAddendaCount = useRef(addenda.length);
  useEffect(() => {
    if (!isEditable) return;
    if (addenda.length <= processedAddendaCount.current) return;

    const newNotes = addenda.slice(processedAddendaCount.current);
    processedAddendaCount.current = addenda.length;

    // Build synthetic facts from note lines and run coding
    const noteFacts = newNotes.flatMap((note, ni) =>
      note.text
        .split('\n')
        .map((line, li) => ({
          id: `note-${processedAddendaCount.current - newNotes.length + ni}-${li}`,
          text: line.replace(/^[\s]*[-*\d.]+\s+/, '').trim(),
          group: 'plan',
        }))
        .filter(f => f.text.length > 4)
    );

    if (noteFacts.length === 0) return;

    // Merge note facts with existing facts and re-run
    fetch('/api/corti/predict-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facts: noteFacts }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const newIcd10: MedicalCode[] = data.icd10 ?? [];
        const newCpt: MedicalCode[] = data.cpt ?? [];
        // Merge: pre-accept new codes alongside existing accepted ones
        setIcd10Suggestions(prev => {
          const existing = new Map(prev.map(c => [c.code, c]));
          newIcd10.forEach(c => { if (!existing.has(c.code)) existing.set(c.code, c); });
          return Array.from(existing.values());
        });
        setCptSuggestions(prev => {
          const existing = new Map(prev.map(c => [c.code, c]));
          newCpt.forEach(c => { if (!existing.has(c.code)) existing.set(c.code, c); });
          return Array.from(existing.values());
        });
        setAcceptedIcd10(prev => {
          const next = new Set(prev);
          newIcd10.forEach(c => next.add(c.code));
          return next;
        });
        setAcceptedCpt(prev => {
          const next = new Set(prev);
          newCpt.forEach(c => next.add(c.code));
          return next;
        });
        setHasRun(true);
      })
      .catch(() => null);
  }, [addenda.length, isEditable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save helper — debounced 600ms
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIcd10 = useRef<Set<string>>(acceptedIcd10);
  const pendingCpt = useRef<Set<string>>(acceptedCpt);

  const scheduleSave = useCallback((icd10: Set<string>, cpt: Set<string>) => {
    pendingIcd10.current = icd10;
    pendingCpt.current = cpt;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await updateMedicalCodes({
          encounterId,
          icd10Codes: Array.from(pendingIcd10.current),
          cptCodes: Array.from(pendingCpt.current),
        });
      } catch (err) {
        toast({
          title: 'Failed to save codes',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    }, 600);
  }, [encounterId, updateMedicalCodes]);

  const toggleIcd10 = useCallback((code: string) => {
    if (!isEditable) return;
    setAcceptedIcd10((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      scheduleSave(next, pendingCpt.current);
      return next;
    });
  }, [isEditable, scheduleSave]);

  const toggleCpt = useCallback((code: string) => {
    if (!isEditable) return;
    setAcceptedCpt((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      scheduleSave(pendingIcd10.current, next);
      return next;
    });
  }, [isEditable, scheduleSave]);

  // Keep refs in sync
  useEffect(() => { pendingIcd10.current = acceptedIcd10; }, [acceptedIcd10]);
  useEffect(() => { pendingCpt.current = acceptedCpt; }, [acceptedCpt]);

  const hasSuggestions = icd10Suggestions.length > 0 || cptSuggestions.length > 0;
  const hasAccepted = acceptedIcd10.size > 0 || acceptedCpt.size > 0;
  const totalAccepted = acceptedIcd10.size + acceptedCpt.size;

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Medical Coding
          </p>
          {hasAccepted && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {totalAccepted} code{totalAccepted !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isEditable && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={runCoding}
            disabled={isLoading || facts.length === 0}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : hasRun ? (
              <RefreshCw className="h-3 w-3" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {isLoading ? 'Analyzing…' : hasRun ? 'Re-run' : 'Suggest Codes'}
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-3 w-1/4" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-32 rounded-full" />)}
          </div>
          <Skeleton className="h-3 w-1/4 mt-2" />
          <div className="flex flex-wrap gap-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-7 w-24 rounded-full" />)}
          </div>
        </div>
      )}

      {/* Empty — no facts yet */}
      {!isLoading && !hasRun && facts.length === 0 && (
        <p className="text-xs text-muted-foreground py-1">
          Available after encounter facts are recorded.
        </p>
      )}

      {/* Suggestions — accept/reject toggles */}
      {!isLoading && hasSuggestions && (
        <div className="space-y-3">
          {icd10Suggestions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                ICD-10-CM Diagnoses
              </p>
              <div className="flex flex-wrap gap-2">
                {icd10Suggestions.map((code) => {
                  const accepted = acceptedIcd10.has(code.code);
                  const evidenceText = code.evidences?.[0]?.text;
                  return (
                    <button
                      key={code.code}
                      disabled={!isEditable}
                      onClick={() => toggleIcd10(code.code)}
                      title={evidenceText ? `Evidence: "${evidenceText}"` : code.description}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        accepted
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border line-through opacity-50 hover:opacity-70'
                      } ${!isEditable ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {accepted ? (
                        <Check className="h-3 w-3 flex-shrink-0" />
                      ) : (
                        <X className="h-3 w-3 flex-shrink-0" />
                      )}
                      <span className="font-mono">{code.code}</span>
                      <span className="max-w-[180px] truncate">{code.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {cptSuggestions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                CPT Procedure Codes
              </p>
              <div className="flex flex-wrap gap-2">
                {cptSuggestions.map((code) => {
                  const accepted = acceptedCpt.has(code.code);
                  const evidenceText = code.evidences?.[0]?.text;
                  return (
                    <button
                      key={code.code}
                      disabled={!isEditable}
                      onClick={() => toggleCpt(code.code)}
                      title={evidenceText ? `Evidence: "${evidenceText}"` : code.description}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        accepted
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-background text-muted-foreground border-border line-through opacity-50 hover:opacity-70'
                      } ${!isEditable ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {accepted ? (
                        <Check className="h-3 w-3 flex-shrink-0" />
                      ) : (
                        <X className="h-3 w-3 flex-shrink-0" />
                      )}
                      <span className="font-mono">{code.code}</span>
                      <span className="max-w-[180px] truncate">{code.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Click a code to remove it. Changes save automatically. Hover for supporting evidence.
          </p>
        </div>
      )}

      {/* Existing codes — no suggestions loaded yet */}
      {!isLoading && !hasSuggestions && hasAccepted && (
        <div className="flex flex-wrap gap-2">
          {Array.from(acceptedIcd10).map((code) => (
            <Badge key={code} variant="secondary" className="font-mono text-xs gap-1">
              <span className="text-[10px] text-muted-foreground">ICD-10</span>
              {code}
            </Badge>
          ))}
          {Array.from(acceptedCpt).map((code) => (
            <Badge key={code} variant="secondary" className="font-mono text-xs gap-1 bg-blue-50 text-blue-700 border-blue-200">
              <span className="text-[10px]">CPT</span>
              {code}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
