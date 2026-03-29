'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { OrgChart } from '@/components/organization/OrgChart';
import { toast } from '@/hooks/use-toast';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Loader2,
  ArrowLeft,
  Check,
  Users,
  Pencil,
  X,
} from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

// ─── Shared inline field editor ───────────────────────────────────────────────

interface FieldEditorProps {
  label: string;
  fieldName: string;
  value: string;
  icon?: React.ReactNode;
  type?: 'text' | 'tel' | 'email' | 'textarea';
  placeholder?: string;
  editingField: string | null;
  tempValue: string;
  saving: boolean;
  canEdit: boolean;
  onEdit: (field: string, value: string) => void;
  onSave: (field: string) => Promise<void>;
  onCancel: () => void;
  onTempChange: (value: string) => void;
}

function FieldEditor({
  label, fieldName, value, icon, type = 'text', placeholder,
  editingField, tempValue, saving, canEdit,
  onEdit, onSave, onCancel, onTempChange,
}: FieldEditorProps) {
  const isEditing = editingField === fieldName;
  const isTextarea = type === 'textarea';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isTextarea) { e.preventDefault(); onSave(fieldName); }
    if (e.key === 'Escape') onCancel();
  };

  const iconPositionClass = isTextarea ? 'top-3' : 'top-1/2 -translate-y-1/2';
  const inputPaddingClass = icon ? 'pl-10' : 'px-4';
  const baseInputClass = `w-full ${inputPaddingClass} pr-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50`;

  const SaveBtn = () => (
    <button
      onClick={() => onSave(fieldName)}
      disabled={saving}
      className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
    </button>
  );

  const CancelBtn = () => (
    <button
      onClick={onCancel}
      className="p-2.5 rounded-lg border border-border hover:bg-muted transition-colors flex-shrink-0"
    >
      <X className="h-4 w-4" />
    </button>
  );

  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {isEditing ? (
        isTextarea ? (
          <div className="space-y-2">
            <div className="relative">
              {icon && <div className={`absolute left-3 ${iconPositionClass} text-muted-foreground pointer-events-none`}>{icon}</div>}
              <textarea
                value={tempValue}
                onChange={(e) => onTempChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`${baseInputClass} min-h-[80px] resize-none`}
                autoFocus
              />
            </div>
            <div className="flex gap-2"><SaveBtn /><CancelBtn /></div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              {icon && <div className={`absolute left-3 ${iconPositionClass} text-muted-foreground pointer-events-none`}>{icon}</div>}
              <input
                type={type}
                value={tempValue}
                onChange={(e) => onTempChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={baseInputClass}
                autoFocus
              />
            </div>
            <SaveBtn /><CancelBtn />
          </div>
        )
      ) : (
        <div className="relative group">
          {icon && <div className={`absolute left-3 ${iconPositionClass} text-muted-foreground pointer-events-none`}>{icon}</div>}
          <div className={`${inputPaddingClass} pr-12 py-2.5 border border-border rounded-lg bg-muted/20 ${isTextarea ? 'min-h-[80px] whitespace-pre-line' : ''}`}>
            {value || <span className="text-muted-foreground italic">Not set</span>}
          </div>
          {canEdit && (
            <button
              onClick={() => onEdit(fieldName, value)}
              className={`absolute right-3 ${isTextarea ? 'top-3' : 'top-1/2 -translate-y-1/2'} opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-primary/10 text-primary transition-all`}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizationPage() {
  const { orgContext, isLoading: orgLoading } = useOrgCtx();
  const [saving, setSaving] = React.useState(false);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [tempValue, setTempValue] = React.useState('');

  const org = useQuery(
    api.organizations.getById,
    orgContext ? { id: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const updateOrg = useMutation(api.organizations.update);

  const [form, setForm] = React.useState({
    name: '',
    clinicName: '',
    clinicPhone: '',
    clinicEmail: '',
    clinicAddress: '',
    emergencyPhone: '',
  });

  const canEdit = orgContext?.isAdmin || false;

  React.useEffect(() => {
    if (org) {
      setForm({
        name: org.name || '',
        clinicName: org.clinicName || '',
        clinicPhone: org.clinicPhone || '',
        clinicEmail: org.clinicEmail || '',
        clinicAddress: org.clinicAddress || '',
        emergencyPhone: org.emergencyPhone || '',
      });
    }
  }, [org]);

  const handleEditField = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setTempValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setTempValue('');
  };

  const handleSaveField = async (fieldName: string) => {
    if (!orgContext) return;
    setSaving(true);
    try {
      await updateOrg({
        id: orgContext.orgId as Id<'organizations'>,
        [fieldName]: tempValue || undefined,
      });
      setForm({ ...form, [fieldName]: tempValue });
      setEditingField(null);
      setTempValue('');
      toast({ title: 'Saved', description: 'Changes saved successfully.' });
    } catch (err) {
      console.error('Failed to save:', err);
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (orgLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const fieldProps = {
    editingField,
    tempValue,
    saving,
    canEdit,
    onEdit: handleEditField,
    onSave: handleSaveField,
    onCancel: handleCancelEdit,
    onTempChange: setTempValue,
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <AppLink
            href="/settings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Settings
          </AppLink>
          <h1 className="text-3xl font-bold">Organisation</h1>
          <p className="text-muted-foreground mt-2">
            Manage your practice information and team structure
          </p>
        </div>

        {/* Practice Information */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Practice Information</h2>
          </div>

          <div className="space-y-4">
            <FieldEditor
              {...fieldProps}
              label="Organisation Name"
              fieldName="name"
              value={form.name}
              icon={<Building2 className="h-4 w-4" />}
            />
            <FieldEditor
              {...fieldProps}
              label="Clinic Display Name"
              fieldName="clinicName"
              value={form.clinicName}
              placeholder="Shown on documents and companion pages"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldEditor
                {...fieldProps}
                label="Phone"
                fieldName="clinicPhone"
                value={form.clinicPhone}
                icon={<Phone className="h-4 w-4" />}
                type="tel"
              />
              <FieldEditor
                {...fieldProps}
                label="Emergency Phone"
                fieldName="emergencyPhone"
                value={form.emergencyPhone}
                icon={<Phone className="h-4 w-4" />}
                type="tel"
              />
            </div>
            <FieldEditor
              {...fieldProps}
              label="Email"
              fieldName="clinicEmail"
              value={form.clinicEmail}
              icon={<Mail className="h-4 w-4" />}
              type="email"
            />
            <FieldEditor
              {...fieldProps}
              label="Address"
              fieldName="clinicAddress"
              value={form.clinicAddress}
              icon={<MapPin className="h-4 w-4" />}
              type="textarea"
            />
          </div>
        </div>

        {/* Team Structure */}
        <div>
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Team Structure</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Organisational hierarchy and team member assignments
            </p>
          </div>
          <div className="border rounded-xl p-6 bg-muted/20">
            {orgContext && (
              <OrgChart
                orgId={orgContext.orgId as Id<'organizations'>}
                currentUserRole={orgContext.role}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
