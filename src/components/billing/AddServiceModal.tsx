"use client";

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AddMoreServicesPhase, type PendingBillingItem } from './AddMoreServicesPhase';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AddServiceModalProps {
  open: boolean;
  onClose: () => void;
  encounterId: Id<'encounters'>;
  orgId: Id<'organizations'>;
  onAdded?: () => void;
}

export function AddServiceModal({
  open,
  onClose,
  encounterId,
  orgId,
  onAdded,
}: AddServiceModalProps) {
  const { user } = useUser();
  const [saving, setSaving] = useState(false);
  const createProspective = useMutation(api.billingItems.createProspective);

  const handleDone = async (items: PendingBillingItem[]) => {
    if (!user?.id || items.length === 0) { onClose(); return; }
    setSaving(true);
    try {
      await Promise.all(
        items.map(item =>
          createProspective({
            userId: user.id,
            encounterId,
            orgId,
            catalogItemId: item.catalogItemId as Id<'billingCatalog'>,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxable: item.taxable,
            extractedFromFact: `dictated-${item.tempId}`,
            confidence: item.confidence,
          })
        )
      );
      onAdded?.();
      onClose();
    } catch (err) {
      toast({
        title: 'Failed to add services',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
        </DialogHeader>
        {saving ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Saving…</p>
          </div>
        ) : (
          <AddMoreServicesPhase
            orgId={orgId}
            onDone={handleDone}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
