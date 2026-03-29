'use client';

import * as React from 'react';
import { X, Mail, Loader2, UserPlus, MapPin } from 'lucide-react';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  maxSeats: number;
  currentSeats: number;
}

export function InviteDialog({
  open,
  onClose,
  maxSeats,
  currentSeats,
}: InviteDialogProps) {
  const { orgContext } = useOrgCtx();
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'practice-admin' | 'provider'>('provider');
  const [locationIds, setLocationIds] = React.useState<Id<'locations'>[]>([]);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const locations = useQuery(
    api.locations.getByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  if (!open) return null;

  const seatsAvailable = currentSeats < maxSeats;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgContext || !email) return;

    // Validate practice-admin has locations
    if (role === 'practice-admin' && locationIds.length === 0) {
      setError('Practice Admins must be assigned to at least one location');
      return;
    }

    if (!seatsAvailable) {
      setError(
        `Seat limit reached (${maxSeats}). Upgrade your plan to add more providers.`
      );
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: orgContext.orgId,
          email,
          role,
          locationIds: role === 'practice-admin' ? locationIds : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send invitation');
      }

      setSuccess(true);
      setEmail('');
      setRole('provider');
      setLocationIds([]);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send invitation'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Invite Team Member</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleInvite} className="p-4 space-y-4">
          {!seatsAvailable && (
            <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
              You&apos;ve reached your seat limit ({maxSeats}). Upgrade your plan
              to invite more team members.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="provider@clinic.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => {
                const newRole = e.target.value as 'admin' | 'practice-admin' | 'provider';
                setRole(newRole);
                // Clear location selection when switching away from practice-admin
                if (newRole !== 'practice-admin') {
                  setLocationIds([]);
                }
              }}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="provider">Provider</option>
              <option value="practice-admin">Practice Admin</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {role === 'admin' && 'Full access to manage team and all locations'}
              {role === 'practice-admin' && 'Manage team and patients at assigned locations only'}
              {role === 'provider' && 'Clinical features only, no team management'}
            </p>
          </div>

          {/* Location Selection for Practice Admin */}
          {role === 'practice-admin' && (
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Assign Locations
                <span className="text-destructive">*</span>
              </label>
              {locations && locations.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                  {locations.map((location) => {
                    const isSelected = locationIds.includes(location._id);
                    return (
                      <label
                        key={location._id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10' : 'hover:bg-accent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setLocationIds([...locationIds, location._id]);
                            } else {
                              setLocationIds(locationIds.filter((id) => id !== location._id));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{location.name}</p>
                          {location.address && (
                            <p className="text-xs text-muted-foreground">{location.address}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic p-3 border border-dashed rounded">
                  No locations created yet. Create locations first to invite practice admins.
                </p>
              )}
              {locationIds.length === 0 && (
                <p className="text-xs text-destructive mt-1">
                  Select at least one location for this practice admin
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              Invitation sent successfully!
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              {currentSeats}/{maxSeats} seats used
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  sending ||
                  !seatsAvailable ||
                  !email ||
                  (role === 'practice-admin' && locationIds.length === 0)
                }
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Invite
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
