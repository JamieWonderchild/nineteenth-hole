'use client';

import { useState, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  Sparkles,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Tag,
  Loader2,
} from 'lucide-react';

interface MedicalCode {
  code: string;
  system: 'ICD-10-CM' | 'ICD-10-PCS' | 'CPT';
  description: string;
  confidence: number;
}

interface MedicalCodingPanelProps {
  encounterId: Id<'encounters'>;
  facts: Array<{ id: string; text: string; group: string }>;
  transcript?: string;
  // Existing accepted codes so we show them pre-selected
  existingIcd10?: string[];
  existingCpt?: string[];
  isEditable?: boolean;
}

export function MedicalCodingPanel({
  encounterId,
  facts,
  transcript,
  existingIcd10 = [],
  existingCpt = [],
  isEditable = true,
}: MedicalCodingPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [icd10Suggestions, setIcd10Suggestions] = useState<MedicalCode[]>([]);
  const [cptSuggestions, setCptSuggestions] = useState<MedicalCode[]>([]);
  const [acceptedIcd10, setAcceptedIcd10] = useState<Set<string>>(new Set(existingIcd10));
  const [acceptedCpt, setAcceptedCpt] = useState<Set<string>>(new Set(existingCpt));
  const [hasRun, setHasRun] = useState(existingIcd10.length > 0 || existingCpt.length > 0);
  const [isExpanded, setIsExpanded] = useState(true);

  const updateMedicalCodes = useMutation(api.encounters.updateMedicalCodes);

  const handleRunCoding = useCallback(async () => {
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
      setIcd10Suggestions(data.icd10 ?? []);
      setCptSuggestions(data.cpt ?? []);

      // Pre-accept high-confidence codes (≥ 0.8)
      const highConfIcd10 = (data.icd10 ?? [])
        .filter((c: MedicalCode) => c.confidence >= 0.8)
        .map((c: MedicalCode) => c.code);
      const highConfCpt = (data.cpt ?? [])
        .filter((c: MedicalCode) => c.confidence >= 0.8)
        .map((c: MedicalCode) => c.code);

      setAcceptedIcd10(new Set([...existingIcd10, ...highConfIcd10]));
      setAcceptedCpt(new Set([...existingCpt, ...highConfCpt]));
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

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateMedicalCodes({
        encounterId,
        icd10Codes: Array.from(acceptedIcd10),
        cptCodes: Array.from(acceptedCpt),
      });
      toast({ title: 'Codes saved' });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save codes',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [encounterId, acceptedIcd10, acceptedCpt, updateMedicalCodes]);

  const toggleIcd10 = (code: string) => {
    setAcceptedIcd10((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleCpt = (code: string) => {
    setAcceptedCpt((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const hasSuggestions = icd10Suggestions.length > 0 || cptSuggestions.length > 0;
  const hasAccepted = acceptedIcd10.size > 0 || acceptedCpt.size > 0;

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
              {acceptedIcd10.size + acceptedCpt.size} accepted
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={handleRunCoding}
              disabled={isLoading || facts.length === 0}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {hasRun ? 'Re-run' : 'Suggest Codes'}
            </Button>
          )}
          {hasSuggestions && (
            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-28 rounded-full" />)}
          </div>
          <Skeleton className="h-4 w-1/4 mt-2" />
          <div className="flex flex-wrap gap-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-7 w-24 rounded-full" />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasRun && facts.length === 0 && (
        <p className="text-xs text-muted-foreground py-1">
          Available after encounter facts are recorded
        </p>
      )}

      {!isLoading && !hasRun && facts.length > 0 && (
        <p className="text-xs text-muted-foreground py-1">
          Click &ldquo;Suggest Codes&rdquo; to get ICD-10 and CPT code suggestions from Corti
        </p>
      )}

      {/* Suggestions */}
      {!isLoading && hasSuggestions && isExpanded && (
        <div className="space-y-4">
          {icd10Suggestions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                ICD-10-CM Diagnoses
              </p>
              <div className="flex flex-wrap gap-2">
                {icd10Suggestions.map((code) => {
                  const accepted = acceptedIcd10.has(code.code);
                  return (
                    <button
                      key={code.code}
                      disabled={!isEditable}
                      onClick={() => isEditable && toggleIcd10(code.code)}
                      title={code.description}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        accepted
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                      } ${!isEditable ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {accepted ? (
                        <Check className="h-3 w-3 flex-shrink-0" />
                      ) : (
                        <X className="h-3 w-3 flex-shrink-0 opacity-50" />
                      )}
                      <span className="font-mono">{code.code}</span>
                      <span className="max-w-[160px] truncate">{code.description}</span>
                      <span className="text-[10px] opacity-60">
                        {Math.round(code.confidence * 100)}%
                      </span>
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
                  return (
                    <button
                      key={code.code}
                      disabled={!isEditable}
                      onClick={() => isEditable && toggleCpt(code.code)}
                      title={code.description}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        accepted
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-background text-muted-foreground border-border hover:border-blue-400 hover:text-foreground'
                      } ${!isEditable ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {accepted ? (
                        <Check className="h-3 w-3 flex-shrink-0" />
                      ) : (
                        <X className="h-3 w-3 flex-shrink-0 opacity-50" />
                      )}
                      <span className="font-mono">{code.code}</span>
                      <span className="max-w-[160px] truncate">{code.description}</span>
                      <span className="text-[10px] opacity-60">
                        {Math.round(code.confidence * 100)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Already-accepted codes from DB (shown when no new suggestions yet) */}
          {isEditable && (
            <div className="flex justify-end">
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save Codes
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Show accepted codes when no suggestions loaded yet (e.g. existing codes from prior session) */}
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
