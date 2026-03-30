"use client";

import { useState, useEffect } from 'react';
import { Id } from 'convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { PendingBillingItem } from './AddMoreServicesPhase';

export const CATEGORIES = [
  { value: 'em',              label: 'E&M (Evaluation & Management)' },
  { value: 'exam',            label: 'Examination' },
  { value: 'procedure',       label: 'Procedure' },
  { value: 'critical-care',   label: 'Critical Care' },
  { value: 'observation',     label: 'Observation' },
  { value: 'lab',             label: 'Lab / Diagnostics' },
  { value: 'medication',      label: 'Medication' },
  { value: 'supply',          label: 'Supply' },
  { value: 'imaging',         label: 'Imaging' },
  { value: 'hospitalization', label: 'Hospitalization' },
  { value: 'other',           label: 'Other' },
];

export function generateCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].substring(0, 6).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase().substring(0, 8);
}

interface ManualServiceFormProps {
  orgId: Id<"organizations">;
  onAdd: (item: PendingBillingItem) => void;
  submitLabel?: string;
  autoFocus?: boolean;
}

export function ManualServiceForm({
  orgId,
  onAdd,
  submitLabel = 'Add to bill & catalog',
  autoFocus = true,
}: ManualServiceFormProps) {
  const { user } = useUser();
  const [name, setName] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [category, setCategory] = useState('other');
  const [code, setCode] = useState('');
  const [taxable, setTaxable] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCatalogItem = useMutation(api.billingCatalog.createFromBilling);

  useEffect(() => { setCode(generateCode(name)); }, [name]);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError('Service name is required.'); return; }
    const priceNum = parseFloat(priceStr);
    if (isNaN(priceNum) || priceNum < 0) { setError('Enter a valid price.'); return; }
    if (!code.trim()) { setError('Code is required.'); return; }
    if (!user?.id) return;

    setSubmitting(true);
    try {
      const catalogItemId = await createCatalogItem({
        userId: user.id,
        orgId,
        name: name.trim(),
        code: code.trim(),
        category,
        basePrice: Math.round(priceNum * 100),
        taxable,
      });
      onAdd({
        tempId: `manual-${Date.now()}`,
        catalogItemId: catalogItemId as string,
        description: name.trim(),
        quantity: 1,
        unitPrice: Math.round(priceNum * 100),
        taxable,
        confidence: 'high',
      });
      // Reset form for potential follow-up additions
      setName('');
      setPriceStr('');
      setCategory('other');
      setCode('');
      setTaxable(true);
      setSubmitting(false);
    } catch (err: any) {
      if (err.message?.startsWith('CODE_CONFLICT:')) {
        const c = err.message.replace('CODE_CONFLICT:', '');
        setError(`Code "${c}" already exists. Change it and try again.`);
      } else {
        setError(err.message || 'Failed to add service.');
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="msf-name" className="text-xs">Service name</Label>
        <Input
          id="msf-name"
          placeholder="e.g. Morphine injection"
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-8 mt-1 text-sm"
          autoFocus={autoFocus}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="msf-price" className="text-xs">Price ($)</Label>
          <Input
            id="msf-price"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={priceStr}
            onChange={e => setPriceStr(e.target.value)}
            className="h-8 mt-1 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="msf-cat" className="text-xs">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="msf-cat" className="h-8 mt-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="msf-code" className="text-xs">
            Code <span className="text-muted-foreground">(auto)</span>
          </Label>
          <Input
            id="msf-code"
            placeholder="e.g. MORPH"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            className="h-8 mt-1 text-sm uppercase"
            maxLength={8}
          />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={taxable}
              onChange={e => setTaxable(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Taxable</span>
          </label>
        </div>
      </div>
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={submitting || !name.trim() || !priceStr}
        className="w-full"
      >
        {submitting
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Saving…</>
          : submitLabel}
      </Button>
    </div>
  );
}
