import { NextRequest, NextResponse } from 'next/server';
import { createCortiClientFromEnv } from '@/services/corti-client';

export const maxDuration = 60;

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number; // cents
  total: number; // cents
  taxable: boolean;
}

interface PatientInfo {
  name?: string;
}

interface GenerateInvoiceRequest {
  interactionId: string;
  invoiceNumber: string;
  invoiceDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number; // cents
  taxAmount: number; // cents
  taxRate: number; // percentage
  grandTotal: number; // cents
  patientInfo: PatientInfo;
  dueDate?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateInvoiceRequest = await request.json();
    const {
      interactionId,
      invoiceNumber,
      invoiceDate,
      lineItems,
      subtotal,
      taxAmount,
      taxRate,
      grandTotal,
      patientInfo,
      dueDate,
    } = body;

    if (!interactionId || !invoiceNumber || !lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const corti = createCortiClientFromEnv();

    // Format currency helper
    const formatCurrency = (cents: number) => {
      return `$${(cents / 100).toFixed(2)}`;
    };

    // Convert line items to facts
    const lineItemFacts = lineItems.map((item, index) => ({
      id: `line-item-${index}`,
      text: `${item.description} - Quantity: ${item.quantity} - Unit Price: ${formatCurrency(item.unitPrice)} - Total: ${formatCurrency(item.total)}${item.taxable ? ' (taxable)' : ''}`,
      group: 'line_items',
      source: 'user' as const,
    }));

    // Invoice metadata facts
    const metadataFacts = [
      {
        id: 'invoice-number',
        text: `Invoice Number: ${invoiceNumber}`,
        group: 'invoice_header',
        source: 'user' as const,
      },
      {
        id: 'invoice-date',
        text: `Invoice Date: ${new Date(invoiceDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`,
        group: 'invoice_header',
        source: 'user' as const,
      },
    ];

    if (dueDate) {
      metadataFacts.push({
        id: 'due-date',
        text: `Due Date: ${new Date(dueDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`,
        group: 'invoice_header',
        source: 'user' as const,
      });
    }

    // Patient info facts
    const patientFacts = [];
    if (patientInfo.name) {
      patientFacts.push({
        id: 'patient-name',
        text: `Patient: ${patientInfo.name}`,
        group: 'patient_info',
        source: 'user' as const,
      });
    }
    // Totals facts
    const totalsFacts = [
      {
        id: 'subtotal',
        text: `Subtotal: ${formatCurrency(subtotal)}`,
        group: 'totals',
        source: 'user' as const,
      },
    ];

    if (taxAmount > 0) {
      totalsFacts.push({
        id: 'tax',
        text: `Tax (${taxRate}%): ${formatCurrency(taxAmount)}`,
        group: 'totals',
        source: 'user' as const,
      });
    }

    totalsFacts.push({
      id: 'grand-total',
      text: `Total Amount Due: ${formatCurrency(grandTotal)}`,
      group: 'totals',
      source: 'user' as const,
    });

    // Combine all facts
    const allFacts = [
      ...metadataFacts,
      ...patientFacts,
      ...lineItemFacts,
      ...totalsFacts,
    ];

    // Generate invoice document using Corti section overrides
    const config = {
      context: [
        {
          type: 'facts' as const,
          data: allFacts,
        },
      ],
      outputLanguage: 'en',
      documentationMode: 'routed_parallel' as const,
      template: {
        sections: [
          {
            key: 'corti-patient-summary',
            nameOverride: 'Invoice Header',
            contentOverride: 'Include: invoice number, invoice date, due date (if present), patient name, date of birth or age, and referring provider from the facts.',
            formatRuleOverride: 'Format as a professional invoice header with clear labeling. Use bold text for invoice number.',
            additionalInstructionsOverride: 'Make this section clean and professional, suitable for a clinical invoice.',
          },
          {
            key: 'corti-plan',
            nameOverride: 'Services Rendered',
            contentOverride: 'Extract all line items from the line_items fact group. Include description, quantity, unit price, and total for each item.',
            formatRuleOverride: 'Format as a table with columns: Description | Quantity | Unit Price | Total. Right-align all monetary values.',
            additionalInstructionsOverride: 'Create a clean, easy-to-read itemized list of services. Ensure all numbers are properly formatted with $ symbols.',
          },
          {
            key: 'corti-assessment',
            nameOverride: 'Invoice Summary',
            contentOverride: 'Include subtotal, tax (if applicable), and total amount due from the totals fact group.',
            formatRuleOverride: 'Format as a right-aligned summary section with clear labels. Make the total amount due prominent.',
            additionalInstructionsOverride: 'This is the financial summary. Make the total amount due very clear and easy to find.',
          },
        ],
      },
    };

    // Generate document
    const result = await corti.generateDocumentRaw(interactionId, config);

    if (!result.sections || result.sections.length === 0) {
      console.error('No sections in Corti response:', result);
      return NextResponse.json(
        { error: 'Failed to generate invoice sections' },
        { status: 500 }
      );
    }

    // Normalize Corti sections (name -> title, text -> content)
    const normalizedSections = result.sections.map((section: any) => ({
      key: section.key,
      title: section.name || section.title || section.key,
      content: section.text || section.content || '',
    }));

    return NextResponse.json({
      sections: normalizedSections,
      generatedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Invoice generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}
