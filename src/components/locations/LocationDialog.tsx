'use client';

import * as React from 'react';
import { useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { X, Loader2 } from 'lucide-react';

interface LocationDialogProps {
  orgId: string;
  location?: {
    _id: string;
    name: string;
    address?: string;
    phone?: string;
    isDefault: boolean;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function LocationDialog({
  orgId,
  location,
  onClose,
  onSuccess,
}: LocationDialogProps) {
  const { user } = useUser();
  const [name, setName] = React.useState(location?.name || '');
  const [address, setAddress] = React.useState(location?.address || '');
  const [phone, setPhone] = React.useState(location?.phone || '');
  const [isDefault, setIsDefault] = React.useState(location?.isDefault || false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const createLocation = useMutation(api.locations.create);
  const updateLocation = useMutation(api.locations.update);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Location name is required');
      return;
    }

    if (!user?.id) {
      setError('You must be logged in to manage locations');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (location) {
        // Update existing location
        await updateLocation({
          userId: user.id,
          id: location._id as Id<'locations'>,
          name: name.trim(),
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          isDefault,
        });
      } else {
        // Create new location
        await createLocation({
          userId: user.id,
          orgId: orgId as Id<'organizations'>,
          name: name.trim(),
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          isDefault,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background rounded-lg max-w-md w-full shadow-lg">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold">
            {location ? 'Edit Location' : 'Add Location'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              placeholder="Main Clinic"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              placeholder="123 Main St, City, State 12345"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="isDefault" className="text-sm">
              Set as default location
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {location ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
