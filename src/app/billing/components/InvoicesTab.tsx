"use client";

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { InvoiceCreationModal } from '@/components/billing/InvoiceCreationModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { DollarSign, FileText, Clock, CheckCircle, ChevronRight, Receipt } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import type { OrgContext } from '@/types/billing';

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface InvoicesTabProps {
  orgContext: OrgContext | null;
}

export function InvoicesTab({ orgContext }: InvoicesTabProps) {
  const [selectedConsultation, setSelectedConsultation] = useState<{
    id: Id<"encounters">;
    interactionId: string;
  } | null>(null);

  const encounters = useQuery(
    api.encounters.getConsultationsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<"organizations"> } : "skip"
  );

  if (!orgContext) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Please select an organisation to view invoices.
      </div>
    );
  }

  if (!encounters) {
    return (
      <div className="flex justify-center py-10">
        <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const readyToInvoice = encounters.filter(c => c.publishedAt && !c.invoiceMetadata);
  const invoiced = encounters.filter(c => c.invoiceMetadata?.status === 'finalized');

  const totalInvoiced = invoiced.reduce((sum, c) => sum + (c.invoiceMetadata?.grandTotal || 0), 0);
  const avgInvoice = invoiced.length > 0 ? totalInvoiced / invoiced.length : 0;

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{readyToInvoice.length}</p>
              <p className="text-xs text-muted-foreground">Ready to Invoice</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${(totalInvoiced / 100).toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Total Invoiced</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{invoiced.length > 0 ? `$${(avgInvoice / 100).toFixed(0)}` : '—'}</p>
              <p className="text-xs text-muted-foreground">Avg Invoice</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ready to Invoice */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Ready to Invoice
          </h3>
          {readyToInvoice.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
              {readyToInvoice.length}
            </span>
          )}
        </div>

        {readyToInvoice.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No encounters ready to invoice"
            description="Published encounters without an invoice will appear here."
            size="small"
          />
        ) : (
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {readyToInvoice.map(c => {
              const patient = c.extractedPatientInfo;

              return (
                <div key={c._id} className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-base">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {patient?.name || 'Unknown Patient'}
                    </p>
                    {c.reasonForVisit && (
                      <p className="text-xs text-muted-foreground truncate italic">{c.reasonForVisit}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {c.publishedAt ? formatRelativeDate(c.publishedAt) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <AppLink href={`/encounter/${c._id}`}>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                        View
                      </Button>
                    </AppLink>
                    {c.interactionId && (
                      <Button
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setSelectedConsultation({ id: c._id, interactionId: c.interactionId! })}
                      >
                        <DollarSign className="h-3.5 w-3.5 mr-1" />
                        Invoice
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoiced */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Invoiced
          </h3>
          {invoiced.length > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
              {invoiced.length}
            </span>
          )}
        </div>

        {invoiced.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Completed invoices will appear here."
            size="small"
          />
        ) : (
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {invoiced.map(c => {
              const patient = c.extractedPatientInfo;
              const meta = c.invoiceMetadata!;

              return (
                <AppLink key={c._id} href={`/encounter/${c._id}/documents`} className="block">
                  <div className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                    <div className="h-9 w-9 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 text-base">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {patient?.name || 'Unknown Patient'}
                        </p>
                        {meta.invoiceNumber && (
                          <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                            #{meta.invoiceNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                        ${(meta.grandTotal / 100).toFixed(2)}
                      </p>
                      {meta.finalizedAt && (
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeDate(meta.finalizedAt)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </AppLink>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoice Creation Modal */}
      {selectedConsultation && (
        <InvoiceCreationModal
          isOpen={!!selectedConsultation}
          onClose={() => setSelectedConsultation(null)}
          encounterId={selectedConsultation.id}
          interactionId={selectedConsultation.interactionId}
          orgId={orgContext.orgId as Id<"organizations">}
        />
      )}
    </div>
  );
}
