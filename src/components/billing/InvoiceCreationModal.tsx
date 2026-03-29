"use client";

import { useState, useEffect } from 'react';
import { Id } from 'convex/_generated/dataModel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { ReviewPlannedServicesPhase } from './ReviewPlannedServicesPhase';
import { AddMoreServicesPhase, PendingBillingItem } from './AddMoreServicesPhase';
import { GeneratingInvoicePhase } from './GeneratingInvoicePhase';
import { InvoiceCompletePhase } from './InvoiceCompletePhase';

type Phase = 'review' | 'add-services' | 'generating' | 'complete';

interface InvoiceCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  encounterId: Id<"encounters">;
  interactionId: string;
  orgId: Id<"organizations">;
}

export function InvoiceCreationModal({
  isOpen,
  onClose,
  encounterId,
  interactionId,
  orgId,
}: InvoiceCreationModalProps) {
  const [phase, setPhase] = useState<Phase>('review');
  const [selectedItems, setSelectedItems] = useState<Map<Id<"billingItems">, number>>(new Map());
  const [pendingItems, setPendingItems] = useState<PendingBillingItem[]>([]);

  const billingItems = useQuery(api.billingItems.getByConsultation, { encounterId });
  const organization = useQuery(api.organizations.getById, { id: orgId });

  const prospectiveItems = billingItems?.filter(item => item.phase === 'prospective') || [];

  const taxRate = organization?.taxSettings?.enabled
    ? organization.taxSettings.rate
    : 0;

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('review');
      setSelectedItems(new Map());
      setPendingItems([]);
    }
  }, [isOpen]);

  const handleGenerate = (selections: Map<Id<"billingItems">, number>, pending: PendingBillingItem[]) => {
    setSelectedItems(selections);
    setPendingItems(pending);
    setPhase('generating');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>

        {phase === 'review' && (
          <ReviewPlannedServicesPhase
            encounterId={encounterId}
            orgId={orgId}
            prospectiveItems={prospectiveItems}
            pendingItems={pendingItems}
            onRemovePending={(tempId) => setPendingItems(prev => prev.filter(i => i.tempId !== tempId))}
            onAddPending={(item) => setPendingItems(prev => [...prev, item])}
            onGenerate={handleGenerate}
            onAddMore={() => setPhase('add-services')}
            onCancel={onClose}
          />
        )}

        {phase === 'add-services' && (
          <AddMoreServicesPhase
            orgId={orgId}
            onDone={(items) => {
              setPendingItems(prev => [...prev, ...items]);
              setPhase('review');
            }}
            onCancel={() => setPhase('review')}
          />
        )}

        {phase === 'generating' && (
          <GeneratingInvoicePhase
            encounterId={encounterId}
            interactionId={interactionId}
            orgId={orgId}
            selectedItems={selectedItems}
            pendingItems={pendingItems}
            revenueRecoveryPrompts={[]}
            taxRate={taxRate}
            onComplete={() => setPhase('complete')}
            onError={(error) => console.error('Invoice generation error:', error)}
            onCancel={onClose}
          />
        )}

        {phase === 'complete' && (
          <InvoiceCompletePhase
            encounterId={encounterId}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
