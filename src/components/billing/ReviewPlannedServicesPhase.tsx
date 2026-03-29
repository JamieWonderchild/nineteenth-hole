"use client";

import { useState, useEffect } from 'react';
import { Id } from 'convex/_generated/dataModel';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Mic, DollarSign, X, PenLine, ChevronDown, ChevronUp } from 'lucide-react';
import { PendingBillingItem } from './AddMoreServicesPhase';
import { ManualServiceForm } from './ManualServiceForm';

interface BillingItem {
  _id: Id<"billingItems">;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  confidence?: string;
  phase: string;
  recordingId?: Id<"recordings">;
}

interface ReviewPlannedServicesPhaseProps {
  encounterId: Id<"encounters">;
  orgId: Id<"organizations">;
  prospectiveItems: BillingItem[];
  pendingItems?: PendingBillingItem[];
  onRemovePending?: (tempId: string) => void;
  onAddPending?: (item: PendingBillingItem) => void;
  onGenerate: (selectedItems: Map<Id<"billingItems">, number>, pendingItems: PendingBillingItem[]) => void;
  onAddMore: () => void;
  onCancel: () => void;
}

export function ReviewPlannedServicesPhase({
  encounterId,
  orgId,
  prospectiveItems,
  pendingItems = [],
  onRemovePending,
  onAddPending,
  onGenerate,
  onAddMore,
  onCancel,
}: ReviewPlannedServicesPhaseProps) {
  // Selection state
  const [selectedItems, setSelectedItems] = useState<Map<Id<"billingItems">, number>>(new Map());
  const [showManual, setShowManual] = useState(false);

  // Pre-select high-confidence prospective items
  useEffect(() => {
    const initial = new Map<Id<"billingItems">, number>();
    prospectiveItems.forEach(item => {
      if (item.confidence === 'high') {
        initial.set(item._id, item.quantity);
      }
    });
    setSelectedItems(initial);
  }, [prospectiveItems]);

  const handleToggle = (itemId: Id<"billingItems">, defaultQuantity: number) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.set(itemId, defaultQuantity);
      }
      return next;
    });
  };

  const handleQuantityChange = (itemId: Id<"billingItems">, quantity: number) => {
    if (quantity < 1) return;
    setSelectedItems(prev => {
      const next = new Map(prev);
      next.set(itemId, quantity);
      return next;
    });
  };

  const total = (() => {
    let subtotal = 0;
    selectedItems.forEach((quantity, itemId) => {
      const item = prospectiveItems.find(i => i._id === itemId);
      subtotal += (item?.unitPrice ?? 0) * quantity;
    });
    pendingItems.forEach(item => {
      subtotal += item.unitPrice * item.quantity;
    });
    return subtotal;
  })();

  const confidenceBadge = (confidence?: string) => {
    if (confidence === 'high') return <Badge className="text-xs py-0">High confidence</Badge>;
    if (confidence === 'medium') return <Badge variant="secondary" className="text-xs py-0">Medium</Badge>;
    return <Badge variant="outline" className="text-xs py-0">{confidence || 'unknown'}</Badge>;
  };

  const hasItems = prospectiveItems.length > 0 || pendingItems.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">Review Services</h3>
        <p className="text-sm text-muted-foreground">
          Confirm the services to include on this invoice. High-confidence items are pre-selected.
        </p>
      </div>

      {/* Items list */}
      {!hasItems ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground text-sm">No services were extracted from this encounter.</p>
          <p className="text-xs text-muted-foreground mt-1">Dictate services or add one manually below.</p>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {prospectiveItems.map(item => {
            const isSelected = selectedItems.has(item._id);
            const quantity = selectedItems.get(item._id) ?? item.quantity;
            return (
              <div key={item._id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <Checkbox checked={isSelected} onCheckedChange={() => handleToggle(item._id, item.quantity)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {confidenceBadge(item.confidence)}
                        <span className="text-xs text-muted-foreground">${(item.unitPrice / 100).toFixed(2)} each</span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold flex-shrink-0">${((item.unitPrice * quantity) / 100).toFixed(2)}</p>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">Qty:</span>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => handleQuantityChange(item._id, quantity - 1)} disabled={quantity <= 1}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input type="number" value={quantity} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 1) handleQuantityChange(item._id, val); }} className="h-6 w-12 text-center text-xs" min={1} />
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => handleQuantityChange(item._id, quantity + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {pendingItems.map(item => (
            <div key={item.tempId} className="flex items-start gap-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{item.description}</p>
                      <Badge className="text-xs py-0 bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15">New</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">${(item.unitPrice / 100).toFixed(2)} each · qty {item.quantity}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-sm font-semibold">${((item.unitPrice * item.quantity) / 100).toFixed(2)}</p>
                    {onRemovePending && (
                      <button onClick={() => onRemovePending(item.tempId)} className="text-muted-foreground hover:text-destructive transition-colors" title="Remove">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add more services — two paths */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAddMore}
            className="flex items-center justify-center gap-2 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Mic className="h-3.5 w-3.5" />
            Dictate services
          </button>
          <button
            onClick={() => setShowManual(v => !v)}
            className={`flex items-center justify-center gap-2 py-2 border border-dashed rounded-lg text-sm transition-colors ${
              showManual
                ? 'border-foreground/30 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            <PenLine className="h-3.5 w-3.5" />
            Add manually
            {showManual ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {showManual && onAddPending && (
          <div className="border border-dashed border-border rounded-lg px-4 py-4">
            <ManualServiceForm
              orgId={orgId}
              onAdd={(item) => {
                onAddPending(item);
                setShowManual(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Total + actions */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-medium text-muted-foreground">
            {selectedItems.size + pendingItems.length} item{(selectedItems.size + pendingItems.length) !== 1 ? 's' : ''} selected
          </span>
          <span className="text-xl font-bold">${(total / 100).toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button onClick={() => onGenerate(selectedItems, pendingItems)} className="flex-1 gap-2" disabled={selectedItems.size === 0 && pendingItems.length === 0}>
            <DollarSign className="h-4 w-4" />
            Generate Invoice
          </Button>
        </div>
      </div>
    </div>
  );
}
