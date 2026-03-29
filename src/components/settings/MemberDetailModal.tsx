'use client';

import * as React from 'react';
import { X, Loader2, Save, Shield, ShieldCheck, Stethoscope, MapPin, Building2 } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface MemberDetailModalProps {
  open: boolean;
  onClose: () => void;
  membershipId: Id<'memberships'> | null;
  orgId: Id<'organizations'>;
  currentUserRole: string;
}

const ROLE_CONFIG = {
  owner: {
    label: 'Owner',
    icon: ShieldCheck,
    description: 'Full access to organization, billing, and all locations',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    description: 'Manage team and all locations, cannot manage billing',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  'practice-admin': {
    label: 'Practice Admin',
    icon: Building2,
    description: 'Manage team and patients at assigned locations only',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  provider: {
    label: 'Provider',
    icon: Stethoscope,
    description: 'Clinical features only, access to assigned locations',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
};

export function MemberDetailModal({
  open,
  onClose,
  membershipId,
  orgId,
  currentUserRole,
}: MemberDetailModalProps) {
  const [role, setRole] = React.useState<string>('');
  const [locationIds, setLocationIds] = React.useState<Id<'locations'>[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const membership = useQuery(
    api.memberships.getMembershipForAction,
    membershipId ? { membershipId } : 'skip'
  );

  const locations = useQuery(
    api.locations.getByOrg,
    orgId ? { orgId } : 'skip'
  );

  const provider = useQuery(
    api.providers.getProviderByUserId,
    membership ? { userId: membership.userId } : 'skip'
  );

  const updateRole = useMutation(api.memberships.updateRole);
  const assignLocations = useMutation(api.memberships.assignLocations);

  // Initialize form when membership loads
  React.useEffect(() => {
    if (membership) {
      setRole(membership.role);
      setLocationIds(membership.locationIds || []);
    }
  }, [membership]);

  if (!open || !membership) return null;

  const handleSave = async () => {
    if (!membershipId) return;

    setSaving(true);
    setError(null);

    try {
      // Update role if changed
      if (role !== membership.role) {
        await updateRole({ membershipId, role });
      }

      // Update location assignment if changed
      const currentLocationIds = membership.locationIds || [];
      const locationIdsChanged =
        locationIds.length !== currentLocationIds.length ||
        locationIds.some((id) => !currentLocationIds.includes(id));

      if (locationIdsChanged) {
        await assignLocations({ membershipId, locationIds });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const roleConfig = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.provider;
  const RoleIcon = roleConfig.icon;

  const canChangeRole = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canAssignLocations = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOrgWideRole = role === 'owner' || role === 'admin';
  const requiresLocations = role === 'practice-admin';

  const hasChanges =
    role !== membership.role ||
    JSON.stringify(locationIds.sort()) !== JSON.stringify((membership.locationIds || []).sort());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <div className={`h-10 w-10 rounded-full ${roleConfig.bgColor} flex items-center justify-center`}>
              <RoleIcon className={`h-5 w-5 ${roleConfig.color}`} />
            </div>
            <div>
              <h2 className="font-semibold">{provider?.name || 'Team Member'}</h2>
              <p className="text-xs text-muted-foreground">{provider?.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            {canChangeRole ? (
              <div className="space-y-2">
                {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => {
                  const Icon = config.icon;
                  const isSelected = role === roleKey;
                  return (
                    <button
                      key={roleKey}
                      onClick={() => setRole(roleKey)}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium">{config.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {config.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${roleConfig.bgColor}`}>
                <RoleIcon className={`h-5 w-5 ${roleConfig.color}`} />
                <div>
                  <p className="text-sm font-medium">{roleConfig.label}</p>
                  <p className="text-xs text-muted-foreground">{roleConfig.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* Location Assignment */}
          {!isOrgWideRole && canAssignLocations && (
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location Access
                {requiresLocations && <span className="text-destructive">*</span>}
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
                  No locations created yet. Create locations first to assign members.
                </p>
              )}
              {requiresLocations && locationIds.length === 0 && (
                <p className="text-xs text-destructive mt-1">
                  Practice Admins must be assigned to at least one location
                </p>
              )}
            </div>
          )}

          {isOrgWideRole && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {roleConfig.label} has access to all locations
              </p>
            </div>
          )}

          {/* Member Info */}
          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                membership.status === 'active'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-yellow-50 text-yellow-700'
              }`}>
                {membership.status === 'active' ? 'Active' : 'Pending'}
              </span>
            </div>
            {membership.joinedAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Joined</span>
                <span>{new Date(membership.joinedAt).toLocaleDateString()}</span>
              </div>
            )}
            {membership.lastSeenAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Active</span>
                <span>{new Date(membership.lastSeenAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges || (requiresLocations && locationIds.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
