'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface PhysicalExamProps {
  initialData: string;
  onChange: (text: string) => void;
  onDataChange?: (data: PhysicalExamData) => void;
  patientWeight?: number;
  patientWeightUnit?: 'kg' | 'lb';
  // Add new prop for structured data initialization
  initialStructuredData?: PhysicalExamData;
}

export interface PhysicalExamData {
  vitalSigns: {
    temperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    weight?: number;
    weightUnit?: 'kg' | 'lb';
  };
  clinicalSigns: {
    generalAppearance: string;
    hydrationStatus: string;
    cardiovascular: string;
    respiratory: string;
    gastrointestinal: string;
    musculoskeletal: string;
    neurological: string;
    skin: string;
    other: string;
  };
  notes: string;
}

export function PhysicalExam({ 
  initialData, 
  onChange, 
  onDataChange,
  patientWeight,
  patientWeightUnit,
  initialStructuredData
}: PhysicalExamProps) {
  const [examData, setExamData] = useState<PhysicalExamData>({
    vitalSigns: {
      temperature: undefined,
      heartRate: undefined,
      respiratoryRate: undefined,
      weight: patientWeight,
      weightUnit: patientWeightUnit || 'kg'
    },
    clinicalSigns: {
      generalAppearance: '',
      hydrationStatus: 'Normal',
      cardiovascular: '',
      respiratory: '',
      gastrointestinal: '',
      musculoskeletal: '',
      neurological: '',
      skin: '',
      other: ''
    },
    notes: initialData || ''
  });

  // Memoize the generateTextRepresentation function to avoid recreating it on every render
  const generateTextRepresentation = useCallback((data: PhysicalExamData) => {
    const { vitalSigns, clinicalSigns, notes } = data;
    
    const vitalSignsText = [
      vitalSigns.temperature ? `Temperature: ${vitalSigns.temperature}°C` : '',
      vitalSigns.heartRate ? `Heart Rate: ${vitalSigns.heartRate} bpm` : '',
      vitalSigns.respiratoryRate ? `Respiratory Rate: ${vitalSigns.respiratoryRate} rpm` : '',
      vitalSigns.weight ? `Weight: ${vitalSigns.weight} ${vitalSigns.weightUnit}` : ''
    ].filter(Boolean).join('\n');

    const clinicalSignsText = [
      clinicalSigns.generalAppearance ? `General Appearance: ${clinicalSigns.generalAppearance}` : '',
      clinicalSigns.hydrationStatus ? `Hydration Status: ${clinicalSigns.hydrationStatus}` : '',
      clinicalSigns.cardiovascular ? `Cardiovascular: ${clinicalSigns.cardiovascular}` : '',
      clinicalSigns.respiratory ? `Respiratory: ${clinicalSigns.respiratory}` : '',
      clinicalSigns.gastrointestinal ? `Gastrointestinal: ${clinicalSigns.gastrointestinal}` : '',
      clinicalSigns.musculoskeletal ? `Musculoskeletal: ${clinicalSigns.musculoskeletal}` : '',
      clinicalSigns.neurological ? `Neurological: ${clinicalSigns.neurological}` : '',
      clinicalSigns.skin ? `Skin/Coat: ${clinicalSigns.skin}` : '',
      clinicalSigns.other ? `Other Findings: ${clinicalSigns.other}` : ''
    ].filter(Boolean).join('\n');

    const fullText = [
      vitalSignsText ? `Vital Signs:\n${vitalSignsText}` : '',
      clinicalSignsText ? `Clinical Signs:\n${clinicalSignsText}` : '',
      notes ? `Additional Notes:\n${notes}` : ''
    ].filter(Boolean).join('\n\n');

    onChange(fullText);
  }, [onChange]);

  // Effect to handle initialStructuredData prop
  useEffect(() => {
    if (initialStructuredData) {
      setExamData(initialStructuredData);
      
      // Generate text representation
      generateTextRepresentation(initialStructuredData);
      
      // Call the data change handler if provided
      if (onDataChange) {
        onDataChange(initialStructuredData);
      }
    }
  }, [initialStructuredData, onDataChange, generateTextRepresentation]);

  const handleVitalSignChange = (field: keyof typeof examData.vitalSigns, value: number | string | undefined) => {
    const updatedVitalSigns = {
      ...examData.vitalSigns,
      [field]: value
    };

    const updatedData = {
      ...examData,
      vitalSigns: updatedVitalSigns
    };

    setExamData(updatedData);
    
    // Generate text representation for the original onChange handler
    generateTextRepresentation(updatedData);
    
    // Call the new data change handler if provided
    if (onDataChange) {
      onDataChange(updatedData);
    }
  };

  const handleClinicalSignChange = (field: keyof typeof examData.clinicalSigns, value: string) => {
    const updatedClinicalSigns = {
      ...examData.clinicalSigns,
      [field]: value
    };

    const updatedData = {
      ...examData,
      clinicalSigns: updatedClinicalSigns
    };

    setExamData(updatedData);
    
    // Generate text representation for the original onChange handler
    generateTextRepresentation(updatedData);
    
    // Call the new data change handler if provided
    if (onDataChange) {
      onDataChange(updatedData);
    }
  };

  const handleNotesChange = (value: string) => {
    const updatedData = {
      ...examData,
      notes: value
    };

    setExamData(updatedData);
    
    // Generate text representation for the original onChange handler
    generateTextRepresentation(updatedData);
    
    // Call the new data change handler if provided
    if (onDataChange) {
      onDataChange(updatedData);
    }
  };

  // Quick buttons for hydration status
  const hydrationOptions = [
    { label: 'Normal', value: 'Normal' },
    { label: 'Mild', value: 'Mild dehydration (5%)' },
    { label: 'Moderate', value: 'Moderate dehydration (5-10%)' },
    { label: 'Severe', value: 'Severe dehydration (>10%)' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Physical Examination</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="vitals" className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="vitals">Vital Signs</TabsTrigger>
            <TabsTrigger value="systems">Body Systems</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          
          {/* Vital Signs Tab */}
          <TabsContent value="vitals" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature" className="text-sm">Temperature (°C)</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 38.5"
                  value={examData.vitalSigns.temperature ?? ''}
                  onChange={(e) => handleVitalSignChange('temperature', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heartRate" className="text-sm">Heart Rate (bpm)</Label>
                <Input
                  id="heartRate"
                  type="number"
                  placeholder="e.g., 80"
                  value={examData.vitalSigns.heartRate ?? ''}
                  onChange={(e) => handleVitalSignChange('heartRate', e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="respiratoryRate" className="text-sm">Respiratory Rate (rpm)</Label>
                <Input
                  id="respiratoryRate"
                  type="number"
                  placeholder="e.g., 20"
                  value={examData.vitalSigns.respiratoryRate ?? ''}
                  onChange={(e) => handleVitalSignChange('respiratoryRate', e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-sm">Weight</Label>
                <div className="flex space-x-2">
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g., 15"
                    value={examData.vitalSigns.weight ?? ''}
                    onChange={(e) => handleVitalSignChange('weight', e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="flex-1"
                  />
                  <Select 
                    value={examData.vitalSigns.weightUnit} 
                    onValueChange={(value: 'kg' | 'lb') => handleVitalSignChange('weightUnit', value)}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="lb">lb</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator className="my-2" />

            <div className="space-y-2">
              <Label htmlFor="generalAppearance" className="text-sm">General Appearance</Label>
              <Textarea
                id="generalAppearance"
                placeholder="Describe the animal's general appearance, behavior, and demeanor..."
                rows={2}
                value={examData.clinicalSigns.generalAppearance}
                onChange={(e) => handleClinicalSignChange('generalAppearance', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Hydration Status</Label>
              <div className="flex flex-wrap gap-2">
                {hydrationOptions.map((option) => (
                  <Button 
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={examData.clinicalSigns.hydrationStatus === option.value ? "default" : "outline"}
                    onClick={() => handleClinicalSignChange('hydrationStatus', option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
          
          {/* Body Systems Tab */}
          <TabsContent value="systems" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cardiovascular" className="text-sm">Cardiovascular</Label>
              <Textarea
                id="cardiovascular"
                placeholder="Heart sounds, pulse quality, rhythm, etc."
                rows={2}
                value={examData.clinicalSigns.cardiovascular}
                onChange={(e) => handleClinicalSignChange('cardiovascular', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="respiratory" className="text-sm">Respiratory</Label>
              <Textarea
                id="respiratory"
                placeholder="Breathing pattern, lung sounds, cough, etc."
                rows={2}
                value={examData.clinicalSigns.respiratory}
                onChange={(e) => handleClinicalSignChange('respiratory', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="gastrointestinal" className="text-sm">Gastrointestinal</Label>
              <Textarea
                id="gastrointestinal"
                placeholder="Abdomen palpation, bowel sounds, etc."
                rows={2}
                value={examData.clinicalSigns.gastrointestinal}
                onChange={(e) => handleClinicalSignChange('gastrointestinal', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="musculoskeletal" className="text-sm">Musculoskeletal</Label>
              <Textarea
                id="musculoskeletal"
                placeholder="Gait, joint mobility, muscle tone, etc."
                rows={2}
                value={examData.clinicalSigns.musculoskeletal}
                onChange={(e) => handleClinicalSignChange('musculoskeletal', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="neurological" className="text-sm">Neurological</Label>
              <Textarea
                id="neurological"
                placeholder="Mentation, reflexes, proprioception, etc."
                rows={2}
                value={examData.clinicalSigns.neurological}
                onChange={(e) => handleClinicalSignChange('neurological', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="skin" className="text-sm">Skin/Coat</Label>
              <Textarea
                id="skin"
                placeholder="Lesions, parasites, hair loss, etc."
                rows={2}
                value={examData.clinicalSigns.skin}
                onChange={(e) => handleClinicalSignChange('skin', e.target.value)}
              />
            </div>
          </TabsContent>
          
          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="other" className="text-sm">Other Findings</Label>
              <Textarea
                id="other"
                placeholder="Enter any other relevant examination findings..."
                rows={4}
                value={examData.clinicalSigns.other}
                onChange={(e) => handleClinicalSignChange('other', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Enter any additional notes about the examination..."
                rows={4}
                value={examData.notes}
                onChange={(e) => handleNotesChange(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}