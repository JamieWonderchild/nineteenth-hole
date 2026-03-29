import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Patient } from '@/lib/types/patient';

type PatientInfoProps = Pick<Patient, 'name' | 'age' | 'weight'>;

export const PatientInfo = ({
  name,
  age,
  weight,
}: PatientInfoProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block">Name</label>
            <p className="text-gray-700">{name}</p>
          </div>
          <div>
            <label className="text-sm font-medium block">Age</label>
            <p className="text-gray-700">{age}</p>
          </div>
          <div>
            <label className="text-sm font-medium block">Weight</label>
            <p className="text-gray-700">{weight}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
