import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, Calendar, FileText, Stethoscope, ClipboardList, Pill, CalendarClock } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PhysicalExam {
  temperature?: number;
  weight?: number;
  heartRate?: number;
  respiratoryRate?: number;
  notes?: string;
}

interface Encounter {
  _id: string;
  date: string;
  transcription?: string;
  physicalExam?: PhysicalExam;
  diagnosis?: string;
  treatment?: string;
  followUp?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConsultationHistoryProps {
  encounters: Encounter[];
  onClose: () => void;
}

const ConsultationHistory = ({ encounters, onClose }: ConsultationHistoryProps) => {
  const sortedConsultations = [...encounters].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const VitalSigns = ({ exam }: { exam: PhysicalExam }) => {
    if (!exam.temperature && !exam.weight && !exam.heartRate && !exam.respiratoryRate) {
      return null;
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg mb-4">
        {exam.temperature && (
          <div>
            <div className="text-sm text-gray-500">Temperature</div>
            <div className="font-medium">{exam.temperature}°F</div>
          </div>
        )}
        {exam.weight && (
          <div>
            <div className="text-sm text-gray-500">Weight</div>
            <div className="font-medium">{exam.weight} lbs</div>
          </div>
        )}
        {exam.heartRate && (
          <div>
            <div className="text-sm text-gray-500">Heart Rate</div>
            <div className="font-medium">{exam.heartRate} bpm</div>
          </div>
        )}
        {exam.respiratoryRate && (
          <div>
            <div className="text-sm text-gray-500">Respiratory Rate</div>
            <div className="font-medium">{exam.respiratoryRate} rpm</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-end">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedConsultations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No previous encounters found
          </div>
        ) : (
          sortedConsultations.map((encounter) => (
            <Collapsible key={encounter._id} className="border rounded-lg">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <div className="text-left">
                      <div className="font-medium">
                        {formatDate(encounter.date)}
                      </div>
                      {encounter.diagnosis && (
                        <div className="text-sm text-gray-500">
                          Diagnosis: {encounter.diagnosis}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t">
                <div className="p-4 space-y-4">
                  {encounter.physicalExam && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                        <Stethoscope className="h-4 w-4" />
                        <span>Physical Examination</span>
                      </div>
                      <VitalSigns exam={encounter.physicalExam} />
                      {encounter.physicalExam.notes && (
                        <div className="pl-6 text-sm whitespace-pre-wrap">
                          {encounter.physicalExam.notes}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {encounter.transcription && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                        <FileText className="h-4 w-4" />
                        <span>Encounter Notes</span>
                      </div>
                      <div className="pl-6 text-sm whitespace-pre-wrap">
                        {encounter.transcription}
                      </div>
                    </div>
                  )}

                  {encounter.diagnosis && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                        <ClipboardList className="h-4 w-4" />
                        <span>Diagnosis</span>
                      </div>
                      <div className="pl-6 text-sm whitespace-pre-wrap">
                        {encounter.diagnosis}
                      </div>
                    </div>
                  )}

                  {encounter.treatment && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                        <Pill className="h-4 w-4" />
                        <span>Treatment Plan</span>
                      </div>
                      <div className="pl-6 text-sm whitespace-pre-wrap">
                        {encounter.treatment}
                      </div>
                    </div>
                  )}

                  {encounter.followUp && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                        <CalendarClock className="h-4 w-4" />
                        <span>Follow-up Instructions</span>
                      </div>
                      <div className="pl-6 text-sm whitespace-pre-wrap">
                        {encounter.followUp}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ConsultationHistory;