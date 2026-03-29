'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, UserCheck } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface TeamAssignmentStepProps {
  onNext: () => void;
  onBack: () => void;
  data: any;
  setData: (data: any) => void;
}

export function TeamAssignmentStep({
  onNext,
  onBack,
  data,
}: TeamAssignmentStepProps) {
  const [assignments, setAssignments] = useState<
    Record<string, Id<'locations'>[]>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const orgId = data.orgId as Id<'organizations'> | undefined;

  // Load all team members
  const allMembers = useQuery(
    api.memberships.getByOrg,
    orgId ? { orgId } : 'skip'
  );

  // Load providers to get user names
  const providers = useQuery(
    api.providers.getProvidersByOrg,
    orgId ? { orgId } : 'skip'
  );

  // Load locations
  const locations = useQuery(
    api.locations.getByOrg,
    orgId ? { orgId } : 'skip'
  );

  const assignLocations = useMutation(api.memberships.assignLocations);

  // Filter to unassigned members (no locationIds or empty array)
  // and enrich with user names from providers table
  const unassignedMembers =
    allMembers
      ?.filter(
        (m) =>
          m.status === 'active' &&
          (!m.locationIds || m.locationIds.length === 0)
      )
      .map((member) => {
        const provider = providers?.find((v) => v.userId === member.userId);
        return {
          ...member,
          name: provider?.name || 'Unknown User',
          email: provider?.email,
        };
      }) || [];

  const hasUnassignedMembers = unassignedMembers.length > 0;

  // Initialize with default location for all unassigned members
  useEffect(() => {
    if (unassignedMembers.length > 0 && locations && locations.length > 0) {
      const defaultLocation = locations.find((loc) => loc.isDefault);
      if (defaultLocation && Object.keys(assignments).length === 0) {
        const initialAssignments: Record<string, Id<'locations'>[]> = {};
        unassignedMembers.forEach((member) => {
          initialAssignments[member._id] = [defaultLocation._id];
        });
        setAssignments(initialAssignments);
      }
    }
  }, [unassignedMembers, locations, assignments]);

  const handleNext = async () => {
    if (!hasUnassignedMembers) {
      onNext();
      return;
    }

    setIsSubmitting(true);

    try {
      // Assign locations to all members with selections
      for (const [membershipId, locationIds] of Object.entries(assignments)) {
        if (locationIds.length > 0) {
          await assignLocations({
            membershipId: membershipId as Id<'memberships'>,
            locationIds,
          });
        }
      }

      onNext();
    } catch (error) {
      console.error('Failed to assign locations:', error);
      alert('Failed to assign team members. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onNext();
  };

  const updateAssignment = (
    membershipId: string,
    locationId: Id<'locations'>
  ) => {
    setAssignments({
      ...assignments,
      [membershipId]: [locationId],
    });
  };

  if (!hasUnassignedMembers) {
    // No unassigned members - show success state and continue
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <UserCheck className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">All Set!</h1>
            <p className="text-muted-foreground">
              All team members are already assigned to locations
            </p>
          </div>

          <div className="flex justify-between">
            <Button onClick={onBack} variant="outline" disabled={isSubmitting}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={isSubmitting}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Assign Team Members</h1>
          <p className="text-muted-foreground">
            Assign unassigned team members to locations
          </p>
        </div>

        <div className="border rounded-lg p-6">
          <h3 className="font-semibold mb-4">
            Unassigned Members ({unassignedMembers.length})
          </h3>
          <div className="space-y-4">
            {unassignedMembers.map((member) => (
              <div
                key={member._id}
                className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {member.email && <span className="mr-2">{member.email}</span>}
                    <span className="capitalize">{member.role}</span>
                  </p>
                </div>

                <div className="w-64">
                  <Label htmlFor={`location-${member._id}`} className="sr-only">
                    Assign location
                  </Label>
                  <Select
                    value={assignments[member._id]?.[0] || ''}
                    onValueChange={(value) =>
                      updateAssignment(member._id, value as Id<'locations'>)
                    }
                  >
                    <SelectTrigger id={`location-${member._id}`}>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map((location) => (
                        <SelectItem key={location._id} value={location._id}>
                          {location.name}
                          {location.isDefault && ' (Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-muted/50 border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            You can assign team members to different locations now or skip and
            do it later in Settings → Team.
          </p>
        </div>

        <div className="flex justify-between">
          <Button onClick={onBack} variant="outline" disabled={isSubmitting}>
            Back
          </Button>
          <div className="flex gap-3">
            <Button
              onClick={handleSkip}
              variant="ghost"
              disabled={isSubmitting}
            >
              Skip for now
            </Button>
            <Button onClick={handleNext} disabled={isSubmitting}>
              {isSubmitting ? 'Assigning...' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
