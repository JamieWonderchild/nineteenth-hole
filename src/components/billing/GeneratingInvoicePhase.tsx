"use client";

import { useEffect, useState, useRef } from 'react';
import { Id } from 'convex/_generated/dataModel';
import { Card } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { useLanguagePreference } from '@/hooks/useLanguagePreference';
import { PendingBillingItem } from './AddMoreServicesPhase';

interface GeneratingInvoicePhaseProps {
  encounterId: Id<"encounters">;
  interactionId: string;
  orgId: Id<"organizations">;
  selectedItems: Map<Id<"billingItems">, number>;
  pendingItems?: PendingBillingItem[];
  revenueRecoveryPrompts?: Array<{ itemDescription: string; action: string }>;
  taxRate?: number;
  onComplete: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export function GeneratingInvoicePhase({
  encounterId,
  interactionId,
  orgId,
  selectedItems,
  pendingItems = [],
  revenueRecoveryPrompts = [],
  taxRate = 0,
  onComplete,
  onError,
  onCancel,
}: GeneratingInvoicePhaseProps) {
  const { user } = useUser();
  const { language } = useLanguagePreference();
  const [status, setStatus] = useState<'creating' | 'generating' | 'finalizing' | 'complete' | 'error'>('creating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  const createDraftInvoice = useMutation(api.invoices.createDraftInvoice);
  const finalizeInvoice = useMutation(api.invoices.finalizeInvoice);
  const createRetrospective = useMutation(api.billingItems.createRetrospective);

  // Get encounter for patient info
  const encounter = useQuery(api.encounters.getById, { id: encounterId });

  // Get billing items
  const allItems = useQuery(api.billingItems.getByConsultation, { encounterId });

  useEffect(() => {
    if (!encounter || !allItems) return;

    // Prevent multiple runs
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const generateInvoice = async () => {
      try {
        // Step 1: Save any pending (in-memory) items to DB first
        setStatus('creating');
        const pendingIds: Id<"billingItems">[] = [];
        if (pendingItems.length > 0 && user?.id) {
          const saved = await Promise.all(pendingItems.map(item =>
            createRetrospective({
              userId: user.id,
              encounterId,
              orgId,
              catalogItemId: item.catalogItemId as Id<"billingCatalog">,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxable: item.taxable,
              confidence: item.confidence,
            })
          ));
          pendingIds.push(...saved);
        }

        // Step 2: Create draft invoice
        const draftResult = await createDraftInvoice({
          encounterId,
          orgId,
          selectedItemIds: [...Array.from(selectedItems.keys()), ...pendingIds],
          revenueRecoveryPrompts,
          taxRate,
        });

        setInvoiceNumber(draftResult.invoiceNumber);

        // Step 3: Generate invoice document via Corti
        setStatus('generating');

        // Prepare patient info
        const patientInfo = {
          name: encounter.extractedPatientInfo?.name || 'Unknown',
        };

        // Prepare line items with updated quantities
        const lineItems = draftResult.lineItems.map(item => {
          const quantity = selectedItems.get(item.billingItemId) || item.quantity;
          return {
            description: item.description,
            quantity,
            unitPrice: item.unitPrice,
            total: quantity * item.unitPrice,
            taxable: item.taxable,
          };
        });

        const generateResponse = await fetch('/api/corti/generate-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interactionId,
            invoiceNumber: draftResult.invoiceNumber,
            invoiceDate: draftResult.invoiceDate,
            lineItems,
            subtotal: draftResult.subtotal,
            taxAmount: draftResult.taxAmount,
            taxRate: draftResult.taxRate,
            grandTotal: draftResult.grandTotal,
            patientInfo,
            language,
          }),
        });

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json();
          throw new Error(errorData.error || 'Failed to generate invoice document');
        }

        const generatedDoc = await generateResponse.json();

        // Step 4: Finalize invoice
        setStatus('finalizing');
        await finalizeInvoice({
          encounterId,
          generatedDocument: {
            sections: generatedDoc.sections,
            generatedAt: generatedDoc.generatedAt,
          },
        });

        // Step 5: Complete
        setStatus('complete');
        setTimeout(() => {
          onComplete();
        }, 1500);

      } catch (err: any) {
        console.error('Invoice generation error:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Failed to generate invoice');
        onError(err.message || 'Failed to generate invoice');
      }
    };

    generateInvoice();
  }, [encounter, allItems]); // Run once when data is available

  const getStatusText = () => {
    switch (status) {
      case 'creating':
        return 'Creating invoice draft...';
      case 'generating':
        return 'Generating invoice document...';
      case 'finalizing':
        return 'Finalizing invoice...';
      case 'complete':
        return 'Invoice created successfully!';
      case 'error':
        return 'Error generating invoice';
      default:
        return 'Processing...';
    }
  };

  const getStatusIcon = () => {
    if (status === 'complete') {
      return <CheckCircle className="h-12 w-12 text-green-500" />;
    }
    if (status === 'error') {
      return <AlertCircle className="h-12 w-12 text-red-500" />;
    }
    return <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Generating Invoice</h3>
        <p className="text-sm text-muted-foreground">
          Please wait while we create your invoice...
        </p>
      </div>

      <Card className="p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            {getStatusIcon()}
          </div>
          <div>
            <p className="font-medium text-lg mb-1">{getStatusText()}</p>
            {invoiceNumber && (
              <p className="text-sm text-muted-foreground">
                Invoice #{invoiceNumber}
              </p>
            )}
          </div>

          {status === 'creating' && (
            <div className="w-full max-w-xs space-y-2">
              <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-1/3 animate-pulse" />
              </div>
            </div>
          )}

          {status === 'generating' && (
            <div className="w-full max-w-xs space-y-2">
              <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-2/3 animate-pulse" />
              </div>
            </div>
          )}

          {status === 'finalizing' && (
            <div className="w-full max-w-xs space-y-2">
              <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-full animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </Card>

      {status === 'error' && errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => window.location.reload()} className="flex-1">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
