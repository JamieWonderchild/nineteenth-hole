'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Mic } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { PatientHeader } from './components/PatientHeader';
import { ConsultationTimeline } from './components/ConsultationTimeline';
import { PatientHistorySearch } from './components/PatientHistorySearch';
import { CreateDraftDialog } from '@/components/encounter/CreateDraftDialog';

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.id as Id<'patients'>;
  const [showCreateDraft, setShowCreateDraft] = useState(false);
  const [draftDialogReason, setDraftDialogReason] = useState('');
  const [draftDialogAppointment, setDraftDialogAppointment] = useState('');

  const patient = useQuery(api.patients.getPatientById, { id: patientId });
  const encounters = useQuery(
    api.encounters.getByPatientWithDetails,
    { patientId }
  );
  const draftConsultation = useQuery(api.encounters.getDraftByPatient, { patientId });

  const handleNewConsultation = useCallback(() => {
    setDraftDialogReason('');
    setDraftDialogAppointment('');
    setShowCreateDraft(true);
  }, []);

  const handleScheduleFollowUp = useCallback(() => {
    setDraftDialogReason('Follow-up');
    setDraftDialogAppointment('');
    setShowCreateDraft(true);
  }, []);

  return (
    <Layout>
      <BillingGuard feature="Patient Records">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
          <AppLink href="/patient-records">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Patients
            </Button>
          </AppLink>

          {patient === undefined ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : patient === null ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Patient not found</p>
            </div>
          ) : (
            <>
              <PatientHeader
                patient={patient}
                onNewConsultation={handleNewConsultation}
                onScheduleFollowUp={handleScheduleFollowUp}
              />

              {/* Continue Draft Encounter Banner */}
              {draftConsultation && (
                <div className="flex items-center justify-between p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30">
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                      Draft encounter in progress
                    </p>
                    {draftConsultation.reasonForVisit && (
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        {draftConsultation.reasonForVisit}
                      </p>
                    )}
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      Created {new Date(draftConsultation.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <AppLink href={`/encounter/${draftConsultation._id}`}>
                    <Button size="sm" className="gap-1.5">
                      <Mic className="h-3.5 w-3.5" />
                      Continue Encounter
                    </Button>
                  </AppLink>
                </div>
              )}

              <PatientHistorySearch patientId={patientId} />

              <ConsultationTimeline
                encounters={encounters ?? []}
                loading={encounters === undefined}
              />
            </>
          )}
        </div>

        {patient && (
          <CreateDraftDialog
            open={showCreateDraft}
            onOpenChange={setShowCreateDraft}
            initialPatientId={patientId}
            initialPatientName={patient.name}
            initialReasonForVisit={draftDialogReason}
            initialAppointmentTime={draftDialogAppointment}
          />
        )}
      </BillingGuard>
    </Layout>
  );
}
