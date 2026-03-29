'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Users,
  Copy,
  Printer,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface DocumentSection {
  key: string;
  title: string;
  content: string;
}

export interface GeneratedDoc {
  sections: DocumentSection[];
  generatedAt: string;
}

export interface DocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soapNote?: GeneratedDoc | null;
  afterVisitSummary?: GeneratedDoc | null;
  isLoading?: boolean;
  error?: string | null;
  patientName?: string;
  onRetry?: () => void;
}

export function DocumentModal({
  open,
  onOpenChange,
  soapNote,
  afterVisitSummary,
  isLoading = false,
  error = null,
  patientName,
  onRetry,
}: DocumentModalProps) {
  const [copiedTab, setCopiedTab] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState('soap');

  const hasSoapNote = soapNote && soapNote.sections.length > 0;
  const hasAfterVisitSummary = afterVisitSummary && afterVisitSummary.sections.length > 0;
  const hasAnyDocument = hasSoapNote || hasAfterVisitSummary;

  // Format document content for copying/printing
  const formatDocumentText = (doc: GeneratedDoc | null | undefined): string => {
    if (!doc || !doc.sections.length) return '';

    return doc.sections
      .map((section) => `## ${section.title}\n\n${section.content}`)
      .join('\n\n---\n\n');
  };

  const handleCopy = async (docType: 'soap' | 'client') => {
    const doc = docType === 'soap' ? soapNote : afterVisitSummary;
    const text = formatDocumentText(doc);

    if (!text) {
      toast({
        title: 'Nothing to copy',
        description: 'No document content available.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(docType);
      setTimeout(() => setCopiedTab(null), 2000);
      toast({
        title: 'Copied to clipboard',
        description: `${docType === 'soap' ? 'SOAP Note' : 'After-Visit Summary'} copied.`,
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handlePrint = (docType: 'soap' | 'client') => {
    const doc = docType === 'soap' ? soapNote : afterVisitSummary;
    if (!doc || !doc.sections.length) return;

    const title = docType === 'soap' ? 'SOAP Note' : 'After-Visit Summary';
    const printContent = doc.sections
      .map(
        (section) =>
          `<h2 style="margin-top: 1.5em; color: #333;">${section.title}</h2>
           <div style="white-space: pre-wrap; line-height: 1.6;">${section.content}</div>`
      )
      .join('<hr style="margin: 1.5em 0; border: none; border-top: 1px solid #ddd;">');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}${patientName ? ` - ${patientName}` : ''}</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 2em;
                color: #333;
              }
              h1 { color: #111; border-bottom: 2px solid #333; padding-bottom: 0.5em; }
              h2 { font-size: 1.1em; color: #444; }
              .meta { color: #666; font-size: 0.9em; margin-bottom: 2em; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            ${patientName ? `<p class="meta">Patient: ${patientName}</p>` : ''}
            <p class="meta">Generated: ${new Date(doc.generatedAt).toLocaleString()}</p>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const renderDocumentContent = (doc: GeneratedDoc | null | undefined) => {
    if (!doc || !doc.sections.length) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
          <p>No content available</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {doc.sections.map((section, index) => (
          <div key={section.key || index}>
            <h3 className="font-semibold text-lg mb-2">{section.title}</h3>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {section.content}
            </div>
            {index < doc.sections.length - 1 && <Separator className="mt-6" />}
          </div>
        ))}
        <div className="text-xs text-muted-foreground pt-4 border-t">
          Generated: {new Date(doc.generatedAt).toLocaleString()}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generated Documents
            {patientName && (
              <span className="text-muted-foreground font-normal">
                - {patientName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Clinical documentation generated from the encounter.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Generating documents...</p>
            <p className="text-xs text-muted-foreground mt-1">
              This may take a few seconds
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <AlertCircle className="h-8 w-8 mb-4" />
            <p className="font-medium">Document generation failed</p>
            <p className="text-sm mt-2 max-w-md text-center">{error}</p>
            {onRetry && (
              <Button variant="outline" onClick={onRetry} className="mt-4">
                Retry Generation
              </Button>
            )}
            <p className="text-xs mt-4 text-muted-foreground max-w-md text-center">
              This may be due to an issue with the Corti API or the encounter data.
            </p>
          </div>
        ) : !hasAnyDocument ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="h-8 w-8 mb-4 opacity-50" />
            <p>No documents generated yet</p>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="soap" disabled={!hasSoapNote}>
                  <FileText className="h-4 w-4 mr-2" />
                  SOAP Note
                </TabsTrigger>
                <TabsTrigger value="client" disabled={!hasAfterVisitSummary}>
                  <Users className="h-4 w-4 mr-2" />
                  After-Visit Summary
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(activeTab as 'soap' | 'client')}
                  disabled={
                    (activeTab === 'soap' && !hasSoapNote) ||
                    (activeTab === 'client' && !hasAfterVisitSummary)
                  }
                >
                  {copiedTab === activeTab ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {copiedTab === activeTab ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrint(activeTab as 'soap' | 'client')}
                  disabled={
                    (activeTab === 'soap' && !hasSoapNote) ||
                    (activeTab === 'client' && !hasAfterVisitSummary)
                  }
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <TabsContent value="soap" className="mt-0">
                {renderDocumentContent(soapNote)}
              </TabsContent>
              <TabsContent value="client" className="mt-0">
                {renderDocumentContent(afterVisitSummary)}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
