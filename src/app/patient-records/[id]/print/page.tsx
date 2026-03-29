'use client';

import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

const DOC_LABELS: Record<string, string> = {
  soapNote: 'SOAP Note',
  afterVisitSummary: 'After-Visit Summary',
  dischargeInstructions: 'Discharge Instructions',
  referralLetter: 'Referral Letter',
  prescription: 'Prescription',
  labOrder: 'Lab Order',
  shiftHandoff: 'Shift Handoff',
};

export default function PatientPrintPage() {
  const params = useParams();
  const patientId = params.id as Id<'patients'>;

  const patient = useQuery(api.patients.getPatientById, { id: patientId });
  const encounters = useQuery(
    api.encounters.getByPatientWithDetails,
    { patientId }
  );

  if (patient === undefined || encounters === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return <p className="text-center py-16 text-muted-foreground">Patient not found</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Print controls — hidden when printing */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <AppLink href={`/patient-records/${patientId}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </AppLink>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Patient Demographics */}
      <div className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold">{patient.name}</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-sm">
          {patient.age && <div><span className="text-muted-foreground">Age:</span> {patient.age}</div>}
          {patient.weight && <div><span className="text-muted-foreground">Weight:</span> {patient.weight} {patient.weightUnit || ''}</div>}
          {patient.sex && <div><span className="text-muted-foreground">Sex:</span> {patient.sex}</div>}
        </div>
      </div>

      {/* Encounter History */}
      <h2 className="text-lg font-semibold mb-4">Encounter History</h2>
      {encounters && encounters.length > 0 ? (
        <div className="space-y-8">
          {encounters.map((c) => {
            const docs = c.generatedDocuments || {};
            const docEntries = Object.entries(docs).filter(
              ([, val]) => val && typeof val === 'object' && 'sections' in val
            ) as [string, { sections: { key: string; title: string; content: string }[]; generatedAt: string }][];

            return (
              <div key={c._id} className="border-b pb-6 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">
                    {new Date(c.date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h3>
                  {c.status && (
                    <span className="text-xs text-muted-foreground capitalize">{c.status}</span>
                  )}
                </div>

                {c.diagnosis && (
                  <div className="mb-2">
                    <span className="text-sm font-medium">Diagnosis: </span>
                    <span className="text-sm">{c.diagnosis}</span>
                  </div>
                )}

                {/* Generated Documents */}
                {docEntries.length > 0 && (
                  <div className="space-y-4 mt-3">
                    {docEntries.map(([key, doc]) => (
                      <div key={key}>
                        <h4 className="text-sm font-semibold text-primary mb-1">
                          {DOC_LABELS[key] || key}
                        </h4>
                        {doc.sections.map((section) => (
                          <div key={section.key} className="mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                              {section.title}
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{section.content}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Facts summary */}
                {c.facts && c.facts.length > 0 && docEntries.length === 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Clinical Facts</p>
                    <div className="text-sm">
                      {c.facts.map((f) => (
                        <span key={f.id} className="inline-block mr-2 mb-1 px-2 py-0.5 bg-muted rounded text-xs">
                          {f.text}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No encounters recorded</p>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-xs text-muted-foreground text-center print:block">
        Generated on {new Date().toLocaleDateString()} — [PRODUCT_NAME]
      </div>
    </div>
  );
}
