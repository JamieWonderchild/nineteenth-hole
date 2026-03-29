'use client';

import { useState } from 'react';
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
import { debugLog } from '@/lib/debug-logger';

interface PracticeSetupStepProps {
  onNext: () => void;
  onBack: () => void;
  data: any;
  setData: (data: any) => void;
}

export function PracticeSetupStep({
  onNext,
  data,
  setData,
}: PracticeSetupStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNext = () => {
    debugLog.info('PracticeSetupStep', 'handleNext called');
    const newErrors: Record<string, string> = {};

    // Validate required fields
    if (!data.practiceName?.trim()) {
      newErrors.practiceName = 'Practice name is required';
    }
    if (!data.vetCount) {
      newErrors.vetCount = 'Please select the number of providers';
    }

    if (Object.keys(newErrors).length > 0) {
      debugLog.error('PracticeSetupStep', 'Validation errors', newErrors);
      setErrors(newErrors);
      return;
    }

    debugLog.info('PracticeSetupStep', 'Calling onNext()', data);
    onNext();
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Welcome to [PRODUCT_NAME]</h1>
          <p className="text-muted-foreground">
            Let's get your practice set up in just a few minutes
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Practice Name */}
          <div>
            <Label htmlFor="practiceName">
              Practice Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="practiceName"
              placeholder="e.g., Happy Tails Clinical Clinic"
              value={data.practiceName || ''}
              onChange={(e) =>
                setData({ ...data, practiceName: e.target.value })
              }
              className={errors.practiceName ? 'border-destructive' : ''}
            />
            {errors.practiceName && (
              <p className="text-sm text-destructive mt-1">
                {errors.practiceName}
              </p>
            )}
          </div>

          {/* Contact Info */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="clinic@example.com"
                value={data.email || ''}
                onChange={(e) => setData({ ...data, email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Optional</p>
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={data.phone || ''}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Optional</p>
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="123 Main St, City, State 12345"
              value={data.address || ''}
              onChange={(e) => setData({ ...data, address: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">Optional</p>
          </div>

          {/* Provider Count */}
          <div>
            <Label htmlFor="vetCount">
              How many providers will be using [PRODUCT_NAME]?{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Select
              value={data.vetCount?.toString()}
              onValueChange={(value) =>
                setData({ ...data, vetCount: parseInt(value) })
              }
            >
              <SelectTrigger
                id="vetCount"
                className={errors.vetCount ? 'border-destructive' : ''}
              >
                <SelectValue placeholder="Select number of providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Just me (Solo)</SelectItem>
                <SelectItem value="2">2 providers</SelectItem>
                <SelectItem value="3">3 providers</SelectItem>
                <SelectItem value="4">4 providers</SelectItem>
                <SelectItem value="5">5+ providers</SelectItem>
              </SelectContent>
            </Select>
            {errors.vetCount && (
              <p className="text-sm text-destructive mt-1">
                {errors.vetCount}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              This helps us recommend the right plan for you
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="flex justify-end">
          <Button onClick={handleNext} size="lg">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
