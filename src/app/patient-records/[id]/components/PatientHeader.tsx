'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Calendar, Pencil, Check, X, Printer } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { toast } from '@/hooks/use-toast';
import { AppLink } from '@/components/navigation/AppLink';

interface PatientDoc {
  _id: Id<'patients'>;
  name: string;
  dateOfBirth?: string;
  age?: string;
  weight?: string;
  weightUnit?: string;
  sex?: string;
}

type EditableField = 'name' | 'age' | 'weight' | 'sex';

function InlineEdit({
  value,
  field,
  editingField,
  editValue,
  onStartEdit,
  onSave,
  onCancel,
  onEditValueChange,
  placeholder,
  className = '',
}: {
  value: string | undefined;
  field: EditableField;
  editingField: EditableField | null;
  editValue: string;
  onStartEdit: (field: EditableField, currentValue: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onEditValueChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingField === field;

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSave();
    if (e.key === 'Escape') onCancel();
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onSave}
          className="h-7 text-sm w-36"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onMouseDown={(e) => { e.preventDefault(); onSave(); }}
        >
          <Check className="h-3 w-3 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <span className={`group inline-flex items-center gap-1 ${className}`}>
      <span className={value ? '' : 'text-muted-foreground/50 italic'}>
        {value || placeholder}
      </span>
      <button
        onClick={() => onStartEdit(field, value || '')}
        className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
      >
        <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
      </button>
    </span>
  );
}

export function PatientHeader({
  patient,
  onNewConsultation,
  onScheduleFollowUp,
}: {
  patient: PatientDoc;
  onNewConsultation?: () => void;
  onScheduleFollowUp?: () => void;
}) {
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
    if (trimmed === currentValue) { cancelEdit(); return; }
    try {
      await updatePatient({ patientId: patient._id, [editingField]: trimmed || undefined });
      toast({ title: 'Updated' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save.', variant: 'destructive' });
    }
    cancelEdit();
  };

  const editProps = { editingField, editValue, onStartEdit: startEdit, onSave: saveEdit, onCancel: cancelEdit, onEditValueChange: setEditValue };

  return (
    <div className="border border-border rounded-xl bg-card p-5">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-3xl">
          <span className="text-2xl font-bold text-primary">
            {patient.name.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-xl font-bold">
              <InlineEdit value={patient.name} field="name" placeholder="Patient name" {...editProps} />
            </span>
          </div>

          {/* Patient details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            <div className="space-y-1">
              <DetailRow label="Age">
                <InlineEdit value={patient.age} field="age" placeholder="Add age" {...editProps} />
              </DetailRow>
              <DetailRow label="Weight">
                <InlineEdit
                  value={patient.weight ? `${patient.weight} ${patient.weightUnit || 'kg'}` : undefined}
                  field="weight"
                  placeholder="Add weight"
                  {...editProps}
                  onStartEdit={(field) => startEdit(field, patient.weight || '')}
                />
              </DetailRow>
              <DetailRow label="Sex">
                <InlineEdit value={patient.sex} field="sex" placeholder="Add sex" {...editProps} />
              </DetailRow>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onNewConsultation} className="gap-1.5 whitespace-nowrap">
            <PlusCircle className="h-3.5 w-3.5" />
            New Encounter
          </Button>
          <Button variant="outline" size="sm" onClick={onScheduleFollowUp} className="gap-1.5 whitespace-nowrap">
            <Calendar className="h-3.5 w-3.5" />
            Follow-up
          </Button>
          <AppLink href={`/patient-records/${patient._id}/print`}>
            <Button variant="ghost" size="sm" className="gap-1.5 w-full">
              <Printer className="h-3.5 w-3.5" />
              Export
            </Button>
          </AppLink>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-12 flex-shrink-0">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}
