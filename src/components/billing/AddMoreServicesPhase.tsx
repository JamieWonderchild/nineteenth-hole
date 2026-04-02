"use client";

import { useState, useRef } from 'react';
import { Id } from 'convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Mic, Square, Loader2, AlertCircle, PenLine, Minus, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useLanguagePreference } from '@/hooks/useLanguagePreference';
import { useDictation } from '@/hooks/useDictation';
import { AudioLevelIndicator } from '@/components/encounter/AudioLevelIndicator';
import { ManualServiceForm } from './ManualServiceForm';

export interface PendingBillingItem {
  tempId: string;
  catalogItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  confidence: string;
}

interface ExtractedItem {
  factId: string;
  catalogItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  confidence: string;
  reasoning: string;
}

interface AddMoreServicesPhaseProps {
  orgId: Id<"organizations">;
  onDone: (items: PendingBillingItem[]) => void;
  onCancel: () => void;
}

type Screen = 'dictating' | 'confirming';

export function AddMoreServicesPhase({
  orgId,
  onDone,
  onCancel,
}: AddMoreServicesPhaseProps) {
  const [screen, setScreen] = useState<Screen>('dictating');
  const { language } = useLanguagePreference();

  // ── Dictation state ───────────────────────────────────────────────────────
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [interimText, setInterimText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [dictateError, setDictateError] = useState<string | null>(null);
  const transcriptRef = useRef('');

  // ── Confirmation state ────────────────────────────────────────────────────
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [showManual, setShowManual] = useState(false);

  const catalog = useQuery(api.billingCatalog.getByOrg, { orgId });

  const runExtraction = async () => {
    const transcript = transcriptRef.current.trim();
    if (!transcript) {
      setDictateError('Nothing was transcribed. Please try again.');
      setIsExtracting(false);
      return;
    }
    if (!catalog || catalog.length === 0) {
      setDictateError('Your billing catalog is empty. Add items to your catalog first.');
      setIsExtracting(false);
      return;
    }

    setDictateError(null);

    try {
      const factsToUse = [{ id: 'dictated-0', text: transcript, group: 'actions' }];
      const extractRes = await fetch('/api/corti/extract-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facts: factsToUse,
          catalog: catalog.map(c => ({
            _id: c._id, name: c.name, code: c.code,
            category: c.category, basePrice: c.basePrice,
            taxable: c.taxable, description: c.description,
          })),
          existingItems: [],
        }),
      });
      if (!extractRes.ok) throw new Error('Failed to match services to catalog');
      const { extraction } = await extractRes.json();

      const items: ExtractedItem[] = extraction?.extractedItems ?? [];
      setExtractedItems(items);
      const initial = new Map<string, number>();
      items.forEach(item => initial.set(item.catalogItemId, item.quantity));
      setSelected(initial);
      setIsExtracting(false);
      setScreen('confirming');
    } catch (err: unknown) {
      setDictateError(err instanceof Error ? err.message : 'Failed to process recording');
      setIsExtracting(false);
    }
  };

  const { state: dictState, audioLevel, start, stop } = useDictation({
    language,
    onFinalSegment: (text) => {
      const next = (transcriptRef.current + ' ' + text).trim();
      transcriptRef.current = next;
      setTranscriptLines(next.split(/[.!?]+/).map(s => s.trim()).filter(Boolean));
      setInterimText('');
    },
    onInterimSegment: (text) => {
      setInterimText(text);
    },
    onEnded: () => {
      setInterimText('');
      setIsExtracting(true);
      runExtraction();
    },
    onError: (message) => {
      setInterimText('');
      setDictateError(message);
      setIsExtracting(false);
    },
  });

  const handleStart = async () => {
    setDictateError(null);
    transcriptRef.current = '';
    setTranscriptLines([]);
    try {
      await start();
    } catch (err: unknown) {
      setDictateError(err instanceof Error ? err.message : 'Failed to access microphone');
    }
  };

  const handleStop = () => {
    stop();
    setIsExtracting(true); // show spinner immediately while waiting for 'ended'
  };

  // ── Confirmation handlers ─────────────────────────────────────────────────

  const toggleItem = (catalogItemId: string, defaultQty: number) => {
    setSelected(prev => {
      const next = new Map(prev);
      next.has(catalogItemId) ? next.delete(catalogItemId) : next.set(catalogItemId, defaultQty);
      return next;
    });
  };

  const changeQty = (catalogItemId: string, qty: number) => {
    if (qty < 1) return;
    setSelected(prev => new Map(prev).set(catalogItemId, qty));
  };

  const handleConfirm = () => {
    const items: PendingBillingItem[] = extractedItems
      .filter(item => selected.has(item.catalogItemId))
      .map(item => ({
        tempId: item.factId || item.catalogItemId,
        catalogItemId: item.catalogItemId,
        description: item.description,
        quantity: selected.get(item.catalogItemId) ?? item.quantity,
        unitPrice: item.unitPrice,
        taxable: item.taxable,
        confidence: item.confidence,
      }));
    onDone(items);
  };

  const handleManualAdd = (item: PendingBillingItem) => {
    const extractedPending: PendingBillingItem[] = extractedItems
      .filter(i => selected.has(i.catalogItemId))
      .map(i => ({
        tempId: i.factId || i.catalogItemId,
        catalogItemId: i.catalogItemId,
        description: i.description,
        quantity: selected.get(i.catalogItemId) ?? i.quantity,
        unitPrice: i.unitPrice,
        taxable: i.taxable,
        confidence: i.confidence,
      }));
    onDone([...extractedPending, item]);
  };

  const confidenceBadge = (confidence: string) => {
    if (confidence === 'high') return <Badge className="text-xs py-0">High confidence</Badge>;
    if (confidence === 'medium') return <Badge variant="secondary" className="text-xs py-0">Medium</Badge>;
    return <Badge variant="outline" className="text-xs py-0">{confidence}</Badge>;
  };

  const isConnecting = dictState === 'connecting';
  const isRecording = dictState === 'recording';

  // ── Dictation screen ──────────────────────────────────────────────────────

  if (screen === 'dictating') {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold mb-1">Add More Services</h3>
          <p className="text-sm text-muted-foreground">
            Dictate any services not mentioned during the encounter.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 py-6">
          {isConnecting && (
            <>
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
              </div>
              <p className="font-medium text-sm text-muted-foreground">Connecting…</p>
            </>
          )}

          {isRecording && (
            <>
              <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
                <Mic className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">Recording</span>
                <AudioLevelIndicator level={audioLevel} />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Describe the additional services you performed
              </p>
              {(transcriptLines.length > 0 || interimText) && (
                <div className="w-full bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                  {transcriptLines.join('. ')}
                  {interimText && (
                    <span className="opacity-60 italic">{transcriptLines.length > 0 ? ' ' : ''}{interimText}</span>
                  )}
                </div>
              )}
              <Button onClick={handleStop} variant="outline" size="lg" className="gap-2">
                <Square className="h-4 w-4 fill-current" />
                Stop
              </Button>
            </>
          )}

          {isExtracting && (
            <>
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-medium">Matching to catalog…</p>
                {transcriptLines.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                    &ldquo;{transcriptLines.join('. ')}&rdquo;
                  </p>
                )}
              </div>
            </>
          )}

          {!isRecording && !isExtracting && !isConnecting && (
            <>
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <Mic className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">Ready to record</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Describe any additional services you performed
                </p>
              </div>
              <Button onClick={handleStart} size="lg" className="gap-2" disabled={catalog === undefined}>
                <Mic className="h-4 w-4" />
                {catalog === undefined ? 'Loading catalog…' : 'Start Recording'}
              </Button>
            </>
          )}
        </div>

        {dictateError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{dictateError}</AlertDescription>
          </Alert>
        )}

        <div className="border-t pt-4">
          <Button variant="outline" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Confirmation screen ───────────────────────────────────────────────────

  const selectedCount = extractedItems.filter(i => selected.has(i.catalogItemId)).length;
  const total = extractedItems
    .filter(i => selected.has(i.catalogItemId))
    .reduce((sum, i) => sum + i.unitPrice * (selected.get(i.catalogItemId) ?? i.quantity), 0);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">Confirm Services</h3>
        <p className="text-sm text-muted-foreground">
          Review what was matched from your dictation.
        </p>
      </div>

      {transcriptLines.length > 0 && (
        <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
          <p className="text-xs font-medium mb-1 text-foreground">You said:</p>
          &ldquo;{transcriptLines.join('. ')}&rdquo;
        </div>
      )}

      {extractedItems.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          No catalog matches found. Add the service manually below.
        </div>
      ) : (
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {extractedItems.map(item => {
            const isSelected = selected.has(item.catalogItemId);
            const qty = selected.get(item.catalogItemId) ?? item.quantity;
            return (
              <div
                key={item.catalogItemId}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleItem(item.catalogItemId, item.quantity)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {confidenceBadge(item.confidence)}
                        <span className="text-xs text-muted-foreground">
                          ${(item.unitPrice / 100).toFixed(2)} each
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold flex-shrink-0">
                      ${((item.unitPrice * qty) / 100).toFixed(2)}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">Qty:</span>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6"
                          onClick={() => changeQty(item.catalogItemId, qty - 1)} disabled={qty <= 1}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number" value={qty} min={1}
                          onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) changeQty(item.catalogItemId, v); }}
                          className="h-6 w-12 text-center text-xs"
                        />
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6"
                          onClick={() => changeQty(item.catalogItemId, qty + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border border-dashed border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowManual(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2">
            <PenLine className="h-3.5 w-3.5" />
            Not in catalog? Add manually
          </span>
          {showManual ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showManual && (
          <div className="px-4 pb-4 pt-3 border-t border-dashed border-border">
            <ManualServiceForm orgId={orgId} onAdd={handleManualAdd} />
          </div>
        )}
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <span className="text-lg font-bold">${(total / 100).toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScreen('dictating')} className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedCount === 0 && !showManual}
            className="flex-1"
          >
            {`Add ${selectedCount > 0 ? selectedCount : ''} to invoice`}
          </Button>
        </div>
      </div>
    </div>
  );
}
