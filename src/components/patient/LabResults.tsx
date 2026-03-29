'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

// Common blood test fields with human adult reference ranges
const BLOOD_TEST_FIELDS = {
  cbc: [
    { name: 'RBC', label: 'RBC', unit: 'M/μL', referenceRange: '4.5-5.5 (M), 4.0-5.0 (F)' },
    { name: 'HGB', label: 'Hemoglobin', unit: 'g/dL', referenceRange: '13.5-17.5 (M), 12.0-15.5 (F)' },
    { name: 'HCT', label: 'Hematocrit', unit: '%', referenceRange: '41-53 (M), 36-46 (F)' },
    { name: 'WBC', label: 'WBC', unit: '×10³/μL', referenceRange: '4.5-11.0' },
    { name: 'Neutrophils', label: 'Neutrophils', unit: '×10³/μL', referenceRange: '1.8-7.7' },
    { name: 'Lymphocytes', label: 'Lymphocytes', unit: '×10³/μL', referenceRange: '1.0-4.8' },
    { name: 'Platelets', label: 'Platelets', unit: '×10³/μL', referenceRange: '150-400' }
  ],
  chemistry: [
    { name: 'ALT', label: 'ALT', unit: 'U/L', referenceRange: '7-56' },
    { name: 'ALP', label: 'ALP', unit: 'U/L', referenceRange: '44-147' },
    { name: 'BUN', label: 'BUN', unit: 'mg/dL', referenceRange: '7-25' },
    { name: 'Creatinine', label: 'Creatinine', unit: 'mg/dL', referenceRange: '0.74-1.35 (M), 0.59-1.04 (F)' },
    { name: 'Glucose', label: 'Glucose', unit: 'mg/dL', referenceRange: '70-100' },
    { name: 'Total Protein', label: 'Total Protein', unit: 'g/dL', referenceRange: '6.3-8.2' },
    { name: 'Albumin', label: 'Albumin', unit: 'g/dL', referenceRange: '3.5-5.0' },
    { name: 'Globulin', label: 'Globulin', unit: 'g/dL', referenceRange: '2.0-3.5' }
  ],
  electrolytes: [
    { name: 'Sodium', label: 'Sodium', unit: 'mEq/L', referenceRange: '136-145' },
    { name: 'Potassium', label: 'Potassium', unit: 'mEq/L', referenceRange: '3.5-5.0' },
    { name: 'Chloride', label: 'Chloride', unit: 'mEq/L', referenceRange: '98-107' },
    { name: 'Calcium', label: 'Calcium', unit: 'mg/dL', referenceRange: '8.5-10.5' },
    { name: 'Phosphorus', label: 'Phosphorus', unit: 'mg/dL', referenceRange: '2.5-4.5' }
  ]
};

// Common urinalysis fields
const URINALYSIS_FIELDS = [
  { name: 'specificGravity', label: 'Specific Gravity', referenceRange: '1.010-1.030' },
  { name: 'pH', label: 'pH', referenceRange: '4.5-8.0' },
  { name: 'protein', label: 'Protein', options: ['Negative', 'Trace', '1+', '2+', '3+', '4+'] },
  { name: 'glucose', label: 'Glucose', options: ['Negative', 'Trace', '1+', '2+', '3+', '4+'] },
  { name: 'ketones', label: 'Ketones', options: ['Negative', 'Trace', '1+', '2+', '3+', '4+'] },
  { name: 'blood', label: 'Blood', options: ['Negative', 'Trace', '1+', '2+', '3+', '4+'] },
  { name: 'wbc', label: 'WBC', options: ['0-5/hpf', '5-20/hpf', '20-50/hpf', '>50/hpf'] },
  { name: 'rbc', label: 'RBC', options: ['0-5/hpf', '5-20/hpf', '20-50/hpf', '>50/hpf'] },
  { name: 'epithelialCells', label: 'Epithelial Cells', options: ['None', 'Few', 'Moderate', 'Many'] },
  { name: 'bacteria', label: 'Bacteria', options: ['None', 'Few', 'Moderate', 'Many'] },
  { name: 'crystals', label: 'Crystals', options: ['None', 'Struvite', 'Calcium Oxalate', 'Urate', 'Other'] }
];

export interface LabResultsData {
  bloodWork: {
    cbc: Record<string, string>;
    chemistry: Record<string, string>;
    electrolytes: Record<string, string>;
    other: string;
  };
  urinalysis: {
    specificGravity?: string;
    pH?: string;
    protein?: string;
    glucose?: string;
    ketones?: string;
    blood?: string;
    wbc?: string;
    rbc?: string;
    epithelialCells?: string;
    bacteria?: string;
    crystals?: string;
    other: string;
  };
  otherTests: string;
}

interface LabResultsProps {
  initialData?: string;
  onChange: (text: string) => void;
  onDataChange?: (data: LabResultsData) => void;
  // Add prop for structured data initialization
  initialStructuredData?: LabResultsData;
}

export const LabResults: React.FC<LabResultsProps> = ({
  onChange,
  onDataChange,
  initialStructuredData
}) => {
  const [activeBloodTab, setActiveBloodTab] = useState('cbc');
  const [labData, setLabData] = useState<LabResultsData>({
    bloodWork: {
      cbc: {},
      chemistry: {},
      electrolytes: {},
      other: ''
    },
    urinalysis: {
      other: ''
    },
    otherTests: ''
  });

  // Memoize the formatLabDataAsText function to avoid recreating it on every render
  const formatLabDataAsText = useCallback((data: LabResultsData): string => {
    const sections: string[] = [];
    
    // Format blood work
    const bloodWorkLines: string[] = [];
    const bloodCategories = [
      { key: 'cbc', label: 'Complete Blood Count' },
      { key: 'chemistry', label: 'Chemistry Panel' },
      { key: 'electrolytes', label: 'Electrolytes' }
    ];
    
    bloodCategories.forEach(category => {
      const entries = Object.entries(data.bloodWork[category.key as keyof typeof data.bloodWork]);
      if (entries.length > 0) {
        bloodWorkLines.push(`${category.label}:`);
        entries.forEach(([test, value]) => {
          const testInfo = BLOOD_TEST_FIELDS[category.key as keyof typeof BLOOD_TEST_FIELDS].find(t => t.name === test);
          if (testInfo) {
            bloodWorkLines.push(`  ${testInfo.label}: ${value} ${testInfo.unit} (Reference: ${testInfo.referenceRange})`);
          }
        });
        bloodWorkLines.push('');
      }
    });
    
    if (data.bloodWork.other) {
      bloodWorkLines.push('Additional Blood Work Notes:');
      bloodWorkLines.push(data.bloodWork.other);
    }
    
    if (bloodWorkLines.length > 0) {
      sections.push(`Blood Work:\n${bloodWorkLines.join('\n')}`);
    }
    
    // Format urinalysis
    const urinalysisLines: string[] = [];
    const urinalysisEntries = Object.entries(data.urinalysis).filter(([key]) => key !== 'other');
    
    if (urinalysisEntries.length > 0) {
      urinalysisEntries.forEach(([test, value]) => {
        const testInfo = URINALYSIS_FIELDS.find(t => t.name === test);
        if (testInfo) {
          urinalysisLines.push(`${testInfo.label}: ${value}`);
        }
      });
    }
    
    if (data.urinalysis.other) {
      urinalysisLines.push('\nAdditional Urinalysis Notes:');
      urinalysisLines.push(data.urinalysis.other);
    }
    
    if (urinalysisLines.length > 0) {
      sections.push(`Urinalysis:\n${urinalysisLines.join('\n')}`);
    }
    
    // Format other tests
    if (data.otherTests) {
      sections.push(`Other Tests:\n${data.otherTests}`);
    }
    
    return sections.join('\n\n');
  }, []);

  // Effect to handle initialStructuredData prop
  useEffect(() => {
    if (initialStructuredData) {
      setLabData(initialStructuredData);
      
      // Generate text representation
      const formattedText = formatLabDataAsText(initialStructuredData);
      onChange(formattedText);
      
      // Call the data change handler if provided
      if (onDataChange) {
        onDataChange(initialStructuredData);
      }
    }
  }, [initialStructuredData, onChange, onDataChange, formatLabDataAsText]);

  const handleBloodValueChange = (category: 'cbc' | 'chemistry' | 'electrolytes', field: string, value: string) => {
    const updatedBloodWork = {
      ...labData.bloodWork,
      [category]: {
        ...labData.bloodWork[category],
        [field]: value
      }
    };
    
    updateData({
      ...labData,
      bloodWork: updatedBloodWork
    });
  };

  const handleUrinalysisChange = (field: string, value: string) => {
    const updatedUrinalysis = {
      ...labData.urinalysis,
      [field]: value
    };
    
    updateData({
      ...labData,
      urinalysis: updatedUrinalysis
    });
  };

  const handleOtherTextChange = (field: 'other' | 'otherTests', value: string) => {
    if (field === 'other') {
      updateData({
        ...labData,
        bloodWork: {
          ...labData.bloodWork,
          other: value
        }
      });
    } else {
      updateData({
        ...labData,
        otherTests: value
      });
    }
  };

  const handleUrinalysisOtherChange = (value: string) => {
    updateData({
      ...labData,
      urinalysis: {
        ...labData.urinalysis,
        other: value
      }
    });
  };

  const updateData = (newData: LabResultsData) => {
    setLabData(newData);
    
    // Format for text output
    const formattedText = formatLabDataAsText(newData);
    onChange(formattedText);
    
    // Call structured data handler if provided
    if (onDataChange) {
      onDataChange(newData);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Laboratory Results</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="bloodwork" className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="bloodwork">Blood Work</TabsTrigger>
            <TabsTrigger value="urinalysis">Urinalysis</TabsTrigger>
            <TabsTrigger value="other">Other Tests</TabsTrigger>
          </TabsList>
          
          {/* Blood Work Tab */}
          <TabsContent value="bloodwork" className="space-y-4">
            <Tabs value={activeBloodTab} onValueChange={setActiveBloodTab} className="w-full">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="cbc">CBC</TabsTrigger>
                <TabsTrigger value="chemistry">Chemistry</TabsTrigger>
                <TabsTrigger value="electrolytes">Electrolytes</TabsTrigger>
              </TabsList>
              
              {/* CBC Tab */}
              <TabsContent value="cbc" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {BLOOD_TEST_FIELDS.cbc.map((field) => (
                    <div key={field.name} className="space-y-1">
                      <div className="flex justify-between">
                        <Label htmlFor={`cbc-${field.name}`} className="text-sm">
                          {field.label} ({field.unit})
                        </Label>
                        <span className="text-xs text-gray-500">
                          {field.referenceRange}
                        </span>
                      </div>
                      <Input
                        id={`cbc-${field.name}`}
                        placeholder={`Enter value...`}
                        value={labData.bloodWork.cbc[field.name] || ''}
                        onChange={(e) => handleBloodValueChange('cbc', field.name, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              {/* Chemistry Tab */}
              <TabsContent value="chemistry" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {BLOOD_TEST_FIELDS.chemistry.map((field) => (
                    <div key={field.name} className="space-y-1">
                      <div className="flex justify-between">
                        <Label htmlFor={`chem-${field.name}`} className="text-sm">
                          {field.label} ({field.unit})
                        </Label>
                        <span className="text-xs text-gray-500">
                          {field.referenceRange}
                        </span>
                      </div>
                      <Input
                        id={`chem-${field.name}`}
                        placeholder={`Enter value...`}
                        value={labData.bloodWork.chemistry[field.name] || ''}
                        onChange={(e) => handleBloodValueChange('chemistry', field.name, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              {/* Electrolytes Tab */}
              <TabsContent value="electrolytes" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {BLOOD_TEST_FIELDS.electrolytes.map((field) => (
                    <div key={field.name} className="space-y-1">
                      <div className="flex justify-between">
                        <Label htmlFor={`electro-${field.name}`} className="text-sm">
                          {field.label} ({field.unit})
                        </Label>
                        <span className="text-xs text-gray-500">
                          {field.referenceRange}
                        </span>
                      </div>
                      <Input
                        id={`electro-${field.name}`}
                        placeholder={`Enter value...`}
                        value={labData.bloodWork.electrolytes[field.name] || ''}
                        onChange={(e) => handleBloodValueChange('electrolytes', field.name, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
            
            <Separator className="my-4" />
            
            <div className="space-y-2">
              <Label htmlFor="bloodwork-other" className="text-sm">Additional Blood Work Notes</Label>
              <Textarea
                id="bloodwork-other"
                placeholder="Enter any additional blood tests or observations..."
                rows={3}
                value={labData.bloodWork.other}
                onChange={(e) => handleOtherTextChange('other', e.target.value)}
              />
            </div>
          </TabsContent>
          
          {/* Urinalysis Tab */}
          <TabsContent value="urinalysis" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {URINALYSIS_FIELDS.slice(0, 2).map((field) => (
                <div key={field.name} className="space-y-1">
                  <div className="flex justify-between">
                    <Label htmlFor={`uri-${field.name}`} className="text-sm">
                      {field.label}
                    </Label>
                    <span className="text-xs text-gray-500">
                      {field.referenceRange}
                    </span>
                  </div>
                  <Input
                    id={`uri-${field.name}`}
                    placeholder={`Enter value...`}
                    value={labData.urinalysis[field.name as keyof typeof labData.urinalysis] as string || ''}
                    onChange={(e) => handleUrinalysisChange(field.name, e.target.value)}
                  />
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {URINALYSIS_FIELDS.slice(2).map((field) => (
                <div key={field.name} className="space-y-1">
                  <Label htmlFor={`uri-${field.name}`} className="text-sm">
                    {field.label}
                  </Label>
                  {field.options ? (
                    <select
                      id={`uri-${field.name}`}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={labData.urinalysis[field.name as keyof typeof labData.urinalysis] as string || ''}
                      onChange={(e) => handleUrinalysisChange(field.name, e.target.value)}
                    >
                      <option value="">Select...</option>
                      {field.options.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`uri-${field.name}`}
                      placeholder={`Enter value...`}
                      value={labData.urinalysis[field.name as keyof typeof labData.urinalysis] as string || ''}
                      onChange={(e) => handleUrinalysisChange(field.name, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
            
            <div className="space-y-2 mt-4">
              <Label htmlFor="urinalysis-other" className="text-sm">Additional Urinalysis Notes</Label>
              <Textarea
                id="urinalysis-other"
                placeholder="Enter any additional urinalysis observations..."
                rows={3}
                value={labData.urinalysis.other}
                onChange={(e) => handleUrinalysisOtherChange(e.target.value)}
              />
            </div>
          </TabsContent>
          
          {/* Other Tests Tab */}
          <TabsContent value="other" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otherTests" className="text-sm">Other Diagnostic Tests</Label>
              <Textarea
                id="otherTests"
                placeholder="Enter results from other tests like imaging, fecal analysis, cytology, etc..."
                rows={6}
                value={labData.otherTests}
                onChange={(e) => handleOtherTextChange('otherTests', e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};