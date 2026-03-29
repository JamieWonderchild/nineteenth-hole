"use client";

import { Id } from 'convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Download, Printer, FileText } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';

interface InvoiceCompletePhaseProps {
  encounterId: Id<"encounters">;
  onClose: () => void;
}

export function InvoiceCompletePhase({
  encounterId,
  onClose,
}: InvoiceCompletePhaseProps) {
  const encounter = useQuery(api.encounters.getById, { id: encounterId });

  if (!encounter?.invoiceMetadata || !encounter?.generatedDocuments?.invoice) {
    return (
      <div className="space-y-6">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Loading invoice...</p>
        </Card>
      </div>
    );
  }

  const { invoiceMetadata, generatedDocuments } = encounter;
  const invoice = generatedDocuments.invoice!; // Already checked above

  const handlePrint = () => {
    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoiceMetadata.invoiceNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              line-height: 1.6;
              color: #333;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: start;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .invoice-title {
              font-size: 32px;
              font-weight: bold;
              margin: 0;
            }
            .invoice-number {
              text-align: right;
            }
            .invoice-number p {
              margin: 4px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th {
              background-color: #f5f5f5;
              padding: 12px;
              text-align: left;
              font-weight: 600;
              border-bottom: 2px solid #ddd;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #eee;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .totals {
              margin-top: 30px;
              margin-left: auto;
              width: 300px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
            }
            .totals-total {
              border-top: 2px solid #333;
              font-weight: bold;
              font-size: 18px;
              padding-top: 12px;
              margin-top: 8px;
            }
            @media print {
              body {
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="invoice-title">INVOICE</h1>
              <p>${new Date(invoiceMetadata.invoiceDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</p>
              ${encounter.extractedPatientInfo ? `
                <p style="margin-top: 16px;"><strong>${encounter.extractedPatientInfo.name || 'Unknown Patient'}</strong></p>
              ` : ''}
            </div>
            <div class="invoice-number">
              <p style="color: #666;">Invoice Number</p>
              <p style="font-family: monospace; font-weight: bold;">${invoiceMetadata.invoiceNumber}</p>
            </div>
          </div>

          <h2>Services Rendered</h2>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-center" style="width: 80px;">Qty</th>
                <th class="text-right" style="width: 100px;">Price</th>
                <th class="text-right" style="width: 100px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceMetadata.lineItems.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">$${(item.unitPrice / 100).toFixed(2)}</td>
                  <td class="text-right"><strong>$${(item.total / 100).toFixed(2)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>$${(invoiceMetadata.subtotal / 100).toFixed(2)}</span>
            </div>
            ${invoiceMetadata.taxAmount > 0 ? `
              <div class="totals-row">
                <span>Tax (${invoiceMetadata.taxRate}%):</span>
                <span>$${(invoiceMetadata.taxAmount / 100).toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="totals-row totals-total">
              <span>Total Amount Due:</span>
              <span>$${(invoiceMetadata.grandTotal / 100).toFixed(2)}</span>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownload = () => {
    // Create a downloadable text version
    const content = `
INVOICE ${invoiceMetadata.invoiceNumber}
Generated: ${new Date(invoiceMetadata.invoiceDate).toLocaleDateString()}
${invoiceMetadata.dueDate ? `Due: ${new Date(invoiceMetadata.dueDate).toLocaleDateString()}` : ''}

${'='.repeat(60)}

${invoice.sections.map(section => `
${section.title.toUpperCase()}
${'-'.repeat(section.title.length)}

${section.content}

`).join('\n')}

${'='.repeat(60)}

Total Amount Due: $${(invoiceMetadata.grandTotal / 100).toFixed(2)}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceMetadata.invoiceNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Invoice Created Successfully!</h3>
            <p className="text-sm text-muted-foreground">
              Invoice #{invoiceMetadata.invoiceNumber}
            </p>
          </div>
        </div>
      </div>

      <Card className="p-6 max-h-[400px] overflow-y-auto">
        <div className="space-y-6">
          {/* Invoice Header */}
          <div className="border-b pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold mb-1">INVOICE</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(invoiceMetadata.invoiceDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Invoice Number</p>
                <p className="font-mono font-semibold">{invoiceMetadata.invoiceNumber}</p>
              </div>
            </div>
            {encounter.extractedPatientInfo && (
              <div className="mt-4 text-sm">
                <p className="font-semibold">
                  {encounter.extractedPatientInfo.name || 'Unknown Patient'}
                </p>
              </div>
            )}
          </div>

          {/* Services Table */}
          <div>
            <h4 className="font-semibold mb-3">Services Rendered</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">Description</th>
                    <th className="text-center p-2 font-medium w-20">Qty</th>
                    <th className="text-right p-2 font-medium w-24">Price</th>
                    <th className="text-right p-2 font-medium w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoiceMetadata.lineItems.map((item, index) => (
                    <tr key={index}>
                      <td className="p-2">{item.description}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-right">
                        ${(item.unitPrice / 100).toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-medium">
                        ${(item.total / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4">
            <div className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>${(invoiceMetadata.subtotal / 100).toFixed(2)}</span>
              </div>
              {invoiceMetadata.taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({invoiceMetadata.taxRate}%):
                  </span>
                  <span>${(invoiceMetadata.taxAmount / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold">Total Amount Due:</span>
                <span className="text-2xl font-bold">
                  ${(invoiceMetadata.grandTotal / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button variant="outline" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>

      <div className="flex gap-2">
        <Button onClick={onClose} className="flex-1">
          <FileText className="mr-2 h-4 w-4" />
          Done
        </Button>
      </div>
    </div>
  );
}
