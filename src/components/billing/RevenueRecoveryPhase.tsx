"use client";

import { useState } from 'react';
import { Id } from 'convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface BillingItem {
  _id: Id<"billingItems">;
  description: string;
  quantity: number;
  unitPrice: number; // cents
  taxable: boolean;
  confidence?: string;
  phase: string;
}

interface RevenueRecoveryPhaseProps {
  prospectiveItems: BillingItem[];
  selectedItemIds: Set<Id<"billingItems">>;
  onAddItems: (itemIds: Id<"billingItems">[]) => void;
  onContinue: (skippedItems: Array<{ itemDescription: string; action: string }>) => void;
  onCancel: () => void;
}

export function RevenueRecoveryPhase({
  prospectiveItems,
  selectedItemIds,
  onAddItems,
  onContinue,
  onCancel,
}: RevenueRecoveryPhaseProps) {
  // Find unchecked high-confidence items
  const uncheckedHighConfItems = prospectiveItems.filter(
    item => item.confidence === 'high' && !selectedItemIds.has(item._id)
  );

  const [additionalSelections, setAdditionalSelections] = useState<Set<Id<"billingItems">>>(new Set());

  const handleToggle = (itemId: Id<"billingItems">) => {
    setAdditionalSelections(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleContinue = () => {
    // Track revenue recovery actions
    const recoveryPrompts = uncheckedHighConfItems.map(item => ({
      itemDescription: item.description,
      action: additionalSelections.has(item._id) ? 'added' : 'skipped',
    }));

    // Add selected items
    if (additionalSelections.size > 0) {
      onAddItems(Array.from(additionalSelections));
    }

    onContinue(recoveryPrompts);
  };

  // If no unchecked high-confidence items, skip this phase
  if (uncheckedHighConfItems.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Revenue Recovery Check</h3>
          <p className="text-sm text-muted-foreground">
            Reviewing for potentially missed services...
          </p>
        </div>

        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <p className="font-medium mb-1">All set!</p>
              <p className="text-sm text-muted-foreground">
                No potentially missed services detected. You're ready to generate the invoice.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => onContinue([])} className="flex-1">
            Generate Invoice
          </Button>
        </div>
      </div>
    );
  }

  // Calculate potential revenue at risk
  const potentialRevenue = uncheckedHighConfItems.reduce(
    (sum, item) => sum + (item.unitPrice * item.quantity),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Revenue Recovery Check</h3>
        <p className="text-sm text-muted-foreground">
          We noticed some high-confidence services that weren't selected for invoicing.
        </p>
      </div>

      <Card className="p-4 border-amber-500/50 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
              Quick check - did you perform these services?
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              These services were mentioned during the encounter but not selected for invoicing.
              Potential revenue: <span className="font-semibold">${(potentialRevenue / 100).toFixed(2)}</span>
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
        {uncheckedHighConfItems.map(item => {
          const isSelected = additionalSelections.has(item._id);
          const itemTotal = item.unitPrice * item.quantity;

          return (
            <Card
              key={item._id}
              className={`p-4 transition-colors ${
                isSelected ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(item._id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge>high confidence</Badge>
                        <span className="text-sm text-muted-foreground">
                          Qty: {item.quantity} × ${(item.unitPrice / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        ${(itemTotal / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {additionalSelections.size > 0 && (
        <Card className="p-4 bg-green-500/5 border-green-500/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Additional services selected:</span>
            <span className="font-semibold text-green-700 dark:text-green-400">
              +${(
                Array.from(additionalSelections).reduce((sum, itemId) => {
                  const item = uncheckedHighConfItems.find(i => i._id === itemId);
                  return sum + (item ? item.unitPrice * item.quantity : 0);
                }, 0) / 100
              ).toFixed(2)}
            </span>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleContinue} className="flex-1">
          {additionalSelections.size > 0 ? 'Add & Continue' : 'Skip & Continue'}
        </Button>
      </div>
    </div>
  );
}
