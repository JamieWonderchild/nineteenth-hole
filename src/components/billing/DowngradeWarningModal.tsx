'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, MapPin, Users, Info } from 'lucide-react';

interface DowngradeWarningModalProps {
  orgId: Id<'organizations'>;
  currentPlan: 'solo' | 'practice' | 'multi-location';
  targetPlan: 'solo' | 'practice' | 'multi-location';
  onConfirm: () => void;
  onCancel: () => void;
  open: boolean;
}

export function DowngradeWarningModal({
  orgId,
  currentPlan,
  targetPlan,
  onConfirm,
  onCancel,
  open,
}: DowngradeWarningModalProps) {
  const [selectedMembershipsToArchive, setSelectedMembershipsToArchive] = useState<
    Set<Id<'memberships'>>
  >(new Set());
  const [selectedLocationsToArchive, setSelectedLocationsToArchive] = useState<
    Set<Id<'locations'>>
  >(new Set());
  const [isArchiving, setIsArchiving] = useState(false);

  const impact = useQuery(api.upgrade.getDowngradeImpact, {
    orgId,
    targetPlan,
  });

  const archiveMemberships = useMutation(api.upgrade.archiveMemberships);
  const archiveLocations = useMutation(api.upgrade.archiveLocations);

  // Reset selections when modal opens
  useEffect(() => {
    if (open) {
      setSelectedMembershipsToArchive(new Set());
      setSelectedLocationsToArchive(new Set());
    }
  }, [open]);

  if (!impact) {
    return null;
  }

  const needsVetArchival = impact.excess.providers > 0;
  const needsLocationArchival = impact.excess.locations > 0;
  const hasSelectedEnoughVets = selectedMembershipsToArchive.size >= impact.excess.providers;
  const hasSelectedEnoughLocations =
    selectedLocationsToArchive.size >= impact.excess.locations;
  const canProceed =
    impact.canDowngrade ||
    ((!needsVetArchival || hasSelectedEnoughVets) &&
      (!needsLocationArchival || hasSelectedEnoughLocations));

  const handleArchiveAndProceed = async () => {
    if (!canProceed) return;

    setIsArchiving(true);
    try {
      // Archive memberships if needed
      if (selectedMembershipsToArchive.size > 0) {
        await archiveMemberships({
          orgId,
          membershipIds: Array.from(selectedMembershipsToArchive),
          reason: 'plan_downgrade',
        });
      }

      // Archive locations if needed
      if (selectedLocationsToArchive.size > 0) {
        await archiveLocations({
          orgId,
          locationIds: Array.from(selectedLocationsToArchive),
          reason: 'plan_downgrade',
        });
      }

      // Proceed with downgrade
      onConfirm();
    } catch (error) {
      console.error('Failed to archive:', error);
      alert('Failed to archive. Please try again.');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <DialogTitle>Downgrade to {targetPlan.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}?</DialogTitle>
              <DialogDescription>
                Review the changes before proceeding
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Can downgrade without changes */}
          {impact.canDowngrade && !needsVetArchival && !needsLocationArchival && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You can downgrade to {targetPlan} without any changes. Your current setup fits within the new plan limits.
              </AlertDescription>
            </Alert>
          )}

          {/* Need to archive providers */}
          {needsVetArchival && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You have {impact.current.providers} active team members, but {targetPlan} plan only allows {impact.limits.maxVets}.
                  Please select {impact.excess.providers} team member{impact.excess.providers > 1 ? 's' : ''} to archive.
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Select team members to archive ({selectedMembershipsToArchive.size}/{impact.excess.providers})
                </div>

                {impact.memberships
                  .filter((m) => m.role !== 'owner') // Can't archive owner
                  .map((membership) => (
                    <div
                      key={membership._id}
                      className="flex items-start gap-3 p-3 rounded border hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`membership-${membership._id}`}
                        checked={selectedMembershipsToArchive.has(membership._id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedMembershipsToArchive);
                          if (checked) {
                            newSet.add(membership._id);
                          } else {
                            newSet.delete(membership._id);
                          }
                          setSelectedMembershipsToArchive(newSet);
                        }}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`membership-${membership._id}`}
                          className="cursor-pointer font-medium"
                        >
                          {membership.userId}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {membership.role} • Joined {new Date(membership.joinedAt || '').toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Need to archive locations */}
          {needsLocationArchival && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You have {impact.current.locations} locations, but {targetPlan} plan only allows {impact.limits.maxLocations}.
                  Please select {impact.excess.locations} location{impact.excess.locations > 1 ? 's' : ''} to archive.
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4" />
                  Select locations to archive ({selectedLocationsToArchive.size}/{impact.excess.locations})
                </div>

                {impact.locations
                  .filter((l) => !l.isDefault) // Can't archive default location
                  .map((location) => (
                    <div
                      key={location._id}
                      className="flex items-start gap-3 p-3 rounded border hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`location-${location._id}`}
                        checked={selectedLocationsToArchive.has(location._id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedLocationsToArchive);
                          if (checked) {
                            newSet.add(location._id);
                          } else {
                            newSet.delete(location._id);
                          }
                          setSelectedLocationsToArchive(newSet);
                        }}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`location-${location._id}`}
                          className="cursor-pointer font-medium"
                        >
                          {location.name}
                        </Label>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Info about what happens to archived entities */}
          {(needsVetArchival || needsLocationArchival) && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Archived team members and locations will be deactivated but their data will remain accessible.
                If you re-upgrade your plan, you can restore them.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isArchiving}>
            Cancel
          </Button>
          <Button
            onClick={handleArchiveAndProceed}
            disabled={!canProceed || isArchiving}
          >
            {isArchiving ? 'Archiving...' : 'Proceed with Downgrade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
