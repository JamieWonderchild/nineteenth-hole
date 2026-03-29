'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "convex/react";
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { OverviewTab } from './OverviewTab';
import { HistoryTab } from './HistoryTab';
import { DocumentsTab } from './DocumentsTab';
import { AppLink } from '@/components/navigation/AppLink';
import { ExternalLink } from 'lucide-react';

interface PatientDetailsDialogProps {
  patientId: Id<"patients"> | null;
  onClose: () => void;
}

export function PatientDetailsDialog({
  patientId,
  onClose,
}: PatientDetailsDialogProps) {
  const patient = useQuery(
    api.patients.getPatientById,
    patientId ? { id: patientId } : "skip"
  );

  const patientConsultations = useQuery(
    api.encounters.getByPatient,
    patientId ? { patientId } : "skip"
  );

  if (!patientId || !patient) return null;

  return (
    <Dialog open={!!patientId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Patient Record: {patient.name}</DialogTitle>
            <AppLink
              href={`/patient-records/${patientId}`}
              className="flex items-center gap-1 text-xs text-primary hover:underline mr-6"
              onClick={onClose}
            >
              Full View <ExternalLink className="h-3 w-3" />
            </AppLink>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">Medical History</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab patient={patient} />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab
              encounters={patientConsultations || []}
            />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
