'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PlusCircle, FileBarChart, Calendar, Pencil, Check, X } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { toast } from '@/hooks/use-toast';

interface PatientDoc {
  _id: Id<"patients">;
  name: string;
  dateOfBirth?: string;
  age?: string;
  weight?: string;
  weightUnit?: string;
  sex?: string;
}

interface OverviewTabProps {
  patient: PatientDoc;
}

type EditableField = 'name' | 'age' | 'weight' | 'sex';

function EditableRow({
  label,
  value,
  field,
  editingField,
  editValue,
  onStartEdit,
  onSave,
  onCancel,
  onEditValueChange,
  type = 'text',
}: {
  label: string;
  value: string | undefined;
  field: EditableField;
  editingField: EditableField | null;
  editValue: string;
  onStartEdit: (field: EditableField, currentValue: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onEditValueChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingField === field;
  const displayValue = value || undefined;
  const isEmpty = !displayValue;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSave();
    if (e.key === 'Escape') onCancel();
  };

  if (isEditing) {
    return (
      <>
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onSave}
            type={type}
            className="h-7 text-sm"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onMouseDown={(e) => { e.preventDefault(); onSave(); }}>
            <Check className="h-3.5 w-3.5 text-green-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onMouseDown={(e) => { e.preventDefault(); onCancel(); }}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="flex items-center gap-1 group">
        {isEmpty ? (
          <button
            onClick={() => onStartEdit(field, '')}
            className="text-sm text-muted-foreground/60 hover:text-primary cursor-pointer"
          >
            Add {label.toLowerCase()}
          </button>
        ) : (
          <>
            <span className="text-sm">{displayValue}</span>
            <button
              onClick={() => onStartEdit(field, displayValue || '')}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
            >
              <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
            </button>
          </>
        )}
      </div>
    </>
  );
}

export function OverviewTab({ patient }: OverviewTabProps) {
  const updatePatient = useMutation(api.patients.updatePatient);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (field: EditableField, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingField) return;

    const trimmed = editValue.trim();
    const currentValue = patient[editingField] || '';

    if (trimmed === currentValue) {
      cancelEdit();
      return;
    }

    try {
      await updatePatient({
        patientId: patient._id,
        [editingField]: trimmed || undefined,
      });
      toast({
        title: 'Updated',
        description: `${editingField.charAt(0).toUpperCase() + editingField.slice(1)} saved.`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save. Please try again.',
        variant: 'destructive',
      });
    }

    cancelEdit();
  };

  const weightDisplay = patient.weight
    ? `${patient.weight} ${patient.weightUnit || 'kg'}`
    : undefined;

  const dobDisplay = patient.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString()
    : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Patient Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 items-center">
              <EditableRow
                label="Name"
                value={patient.name}
                field="name"
                editingField={editingField}
                editValue={editValue}
                onStartEdit={startEdit}
                onSave={saveEdit}
                onCancel={cancelEdit}
                onEditValueChange={setEditValue}
              />
              <EditableRow
                label="Age"
                value={patient.age}
                field="age"
                editingField={editingField}
                editValue={editValue}
                onStartEdit={startEdit}
                onSave={saveEdit}
                onCancel={cancelEdit}
                onEditValueChange={setEditValue}
              />
              <EditableRow
                label="Weight"
                value={weightDisplay}
                field="weight"
                editingField={editingField}
                editValue={editValue}
                onStartEdit={startEdit}
                onSave={saveEdit}
                onCancel={cancelEdit}
                onEditValueChange={setEditValue}
              />
              <EditableRow
                label="Sex"
                value={patient.sex}
                field="sex"
                editingField={editingField}
                editValue={editValue}
                onStartEdit={startEdit}
                onSave={saveEdit}
                onCancel={cancelEdit}
                onEditValueChange={setEditValue}
              />

              <div className="text-muted-foreground text-sm">Date of Birth</div>
              <div className="text-sm">{dobDisplay || '—'}</div>
            </div>
          </CardContent>
        </Card>

      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <PlusCircle className="w-4 h-4 mr-2" />
              New Encounter
            </Button>
            <Button variant="outline" size="sm">
              <FileBarChart className="w-4 h-4 mr-2" />
              Generate Health Report
            </Button>
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Follow-up
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
