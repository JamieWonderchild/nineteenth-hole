'use client';

import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import {
  Users,
  Crown,
  Shield,
  User,
  MapPin,
  ChevronRight,
  Mail,
} from 'lucide-react';
import { useState } from 'react';
import * as React from 'react';

interface OrgChartProps {
  orgId: Id<'organizations'>;
  currentUserRole: string;
}

interface TeamMember {
  _id: string;
  userId: string;
  name: string;
  email?: string;
  role: string;
  locationIds?: Id<'locations'>[];
  locationNames?: string[];
}

export function OrgChart({ orgId, currentUserRole }: OrgChartProps) {
  // Fetch data
  const memberships = useQuery(
    api.memberships.getByOrg,
    orgId ? { orgId } : 'skip'
  );

  const providers = useQuery(
    api.providers.getProvidersByOrg,
    orgId ? { orgId } : 'skip'
  );

  const locations = useQuery(
    api.locations.getByOrg,
    orgId ? { orgId } : 'skip'
  );

  // Auto-expand all locations by default
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(
    new Set(locations?.map(l => l._id) || [])
  );

  // Update expanded locations when locations load
  React.useEffect(() => {
    if (locations && expandedLocations.size === 0) {
      setExpandedLocations(new Set(locations.map(l => l._id)));
    }
  }, [locations]);

  // Enrich memberships with user data
  const teamMembers: TeamMember[] =
    memberships
      ?.filter((m) => m.status === 'active')
      .map((member) => {
        const provider = providers?.find((v) => v.userId === member.userId);
        const locationNames =
          member.locationIds
            ?.map((locId) => locations?.find((l) => l._id === locId)?.name)
            .filter(Boolean) || [];

        return {
          _id: member._id,
          userId: member.userId,
          name: provider?.name || 'Unknown User',
          email: provider?.email,
          role: member.role,
          locationIds: member.locationIds,
          locationNames: locationNames as string[],
        };
      }) || [];

  // Group by role
  const owners = teamMembers.filter((m) => m.role === 'owner');
  const admins = teamMembers.filter((m) => m.role === 'admin');
  const practiceAdmins = teamMembers.filter((m) => m.role === 'practice-admin');
  const regularVets = teamMembers.filter((m) => m.role === 'provider');

  // Group by location for practice admins and providers
  const membersByLocation = new Map<string, TeamMember[]>();
  const unassignedMembers: TeamMember[] = [];

  [...practiceAdmins, ...regularVets].forEach((member) => {
    if (!member.locationIds || member.locationIds.length === 0) {
      unassignedMembers.push(member);
    } else {
      member.locationIds.forEach((locId) => {
        const existing = membersByLocation.get(locId) || [];
        membersByLocation.set(locId, [...existing, member]);
      });
    }
  });

  const toggleLocation = (locationId: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedLocations(newExpanded);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return Crown;
      case 'admin':
        return Shield;
      case 'practice-admin':
        return Users;
      default:
        return User;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 border-yellow-200/50 dark:border-yellow-800/50';
      case 'admin':
        return 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-800/50';
      case 'practice-admin':
        return 'from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200/50 dark:border-purple-800/50';
      default:
        return 'from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20 border-gray-200/50 dark:border-gray-800/50';
    }
  };

  const getRoleIconColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400';
      case 'admin':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
      case 'practice-admin':
        return 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400';
      default:
        return 'bg-gray-100 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400';
    }
  };

  const MemberCard = ({ member }: { member: TeamMember }) => {
    const Icon = getRoleIcon(member.role);
    return (
      <div
        className={`bg-gradient-to-br ${getRoleColor(member.role)} border rounded-lg p-4`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`h-10 w-10 rounded-lg ${getRoleIconColor(member.role)} flex items-center justify-center flex-shrink-0`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{member.name}</p>
            {member.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Mail className="h-3 w-3" />
                <span className="truncate">{member.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-medium capitalize px-2 py-0.5 rounded-md bg-background/50">
                {member.role.replace('-', ' ')}
              </span>
              {member.locationNames && member.locationNames.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">
                    {member.locationNames.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!memberships || !providers || !locations) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading organization chart...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Owners */}
      {owners.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Leadership
              </h3>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {owners.length}
            </span>
          </div>
          <div className="space-y-3">
            {owners.map((member) => (
              <MemberCard key={member._id} member={member} />
            ))}
          </div>
        </div>
      )}

      {/* Admins */}
      {admins.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Administrators
              </h3>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {admins.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {admins.map((member) => (
              <MemberCard key={member._id} member={member} />
            ))}
          </div>
        </div>
      )}

      {/* By Location */}
      {locations && locations.length > 0 && (
        <div className="pt-6 border-t">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                By Location
              </h3>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {locations.length} {locations.length === 1 ? 'location' : 'locations'}
            </span>
          </div>
          <div className="space-y-3">
            {locations.map((location) => {
              const members = membersByLocation.get(location._id) || [];
              const isExpanded = expandedLocations.has(location._id);

              return (
                <div key={location._id} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleLocation(location._id)}
                    className="w-full px-4 py-3 bg-muted/50 hover:bg-muted transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-medium">{location.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {members.length} team {members.length === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="p-4 space-y-3 bg-background">
                      {members.length > 0 ? (
                        members.map((member) => (
                          <MemberCard key={member._id} member={member} />
                        ))
                      ) : (
                        <div className="text-center py-6">
                          <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            No team members assigned to this location yet
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Assign members in Settings → Team
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unassigned */}
      {unassignedMembers.length > 0 && (
        <div className="pt-6 border-t">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Unassigned
              </h3>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {unassignedMembers.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {unassignedMembers.map((member) => (
              <MemberCard key={member._id} member={member} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {teamMembers.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No team members yet</p>
        </div>
      )}
    </div>
  );
}
