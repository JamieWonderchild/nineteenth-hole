'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Id } from 'convex/_generated/dataModel';

interface Encounter {
  _id: Id<"encounters">;
  patientId: Id<"patients">;
  providerId: string;
  date: string;
  transcription?: string;
  physicalExam?: {
    temperature?: number;
    weight?: number;
    weightUnit?: string;
    heartRate?: number;
    respiratoryRate?: number;
    notes?: string;
  };
  diagnosis?: string;
  treatment?: string;
  followUp?: string;
  createdAt: string;
  updatedAt: string;
}

interface HistoryTabProps {
  encounters: Encounter[];
}

export function HistoryTab({ encounters }: HistoryTabProps) {
  return (
    <div className="flex flex-col">
      {/* Scrollable container with fixed height to work within dialog */}
      <div className="overflow-y-auto pr-2" style={{ maxHeight: '60vh' }}>
        {encounters.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">No medical history available</p>
            </CardContent>
          </Card>
        ) : (
          [...encounters]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((encounter) => (
            <Card key={encounter._id} className="mb-4">
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <CardTitle className="text-lg">
                    Visit: {new Date(encounter.date).toLocaleDateString()}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {encounter.transcription && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Encounter Notes</h4>
                    <p className="text-sm whitespace-pre-line border rounded-md p-2 bg-gray-50">
                      {encounter.transcription}
                    </p>
                  </div>
                )}
                
                {encounter.physicalExam?.notes && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Physical Examination</h4>
                    <p className="text-sm whitespace-pre-line border rounded-md p-2 bg-gray-50">
                      {encounter.physicalExam.notes}
                    </p>
                  </div>
                )}
                
                {/* Display vital signs if any exists */}
                {encounter.physicalExam && 
                  (encounter.physicalExam.weight !== undefined || 
                   encounter.physicalExam.temperature !== undefined ||
                   encounter.physicalExam.heartRate !== undefined ||
                   encounter.physicalExam.respiratoryRate !== undefined) && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Vital Signs</h4>
                    <div className="text-sm border rounded-md p-2 bg-gray-50">
                      {encounter.physicalExam.weight !== undefined && (
                        <p>
                          <strong>Weight:</strong> {encounter.physicalExam.weight} {encounter.physicalExam.weightUnit || 'kg'}
                        </p>
                      )}
                      {encounter.physicalExam.temperature !== undefined && (
                        <p><strong>Temperature:</strong> {encounter.physicalExam.temperature}°C</p>
                      )}
                      {encounter.physicalExam.heartRate !== undefined && (
                        <p><strong>Heart Rate:</strong> {encounter.physicalExam.heartRate} bpm</p>
                      )}
                      {encounter.physicalExam.respiratoryRate !== undefined && (
                        <p><strong>Respiratory Rate:</strong> {encounter.physicalExam.respiratoryRate} rpm</p>
                      )}
                    </div>
                  </div>
                )}
                
                {encounter.diagnosis && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Diagnosis</h4>
                    <p className="text-sm whitespace-pre-line border rounded-md p-2 bg-gray-50">
                      {encounter.diagnosis}
                    </p>
                  </div>
                )}

                {encounter.treatment && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Treatment</h4>
                    <p className="text-sm whitespace-pre-line border rounded-md p-2 bg-gray-50">
                      {encounter.treatment}
                    </p>
                  </div>
                )}
                
                {encounter.followUp && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Follow-up</h4>
                    <p className="text-sm whitespace-pre-line border rounded-md p-2 bg-gray-50">
                      {encounter.followUp}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}