'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { AppLink } from '@/components/navigation/AppLink';
import {
  ArrowLeft,
  MapPin,
  Users,
  Phone,
  Building2,
  Shield,
  ShieldCheck,
  Stethoscope,
  Loader2,
} from 'lucide-react';

const ROLE_ICONS = {
  owner: ShieldCheck,
  admin: Shield,
  'practice-admin': Building2,
  provider: Stethoscope,
};

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  'practice-admin': 'Practice Admin',
  provider: 'Provider',
};

export default function LocationDetailPage() {
  const params = useParams();
  const { orgContext, isLoading: orgLoading } = useOrgCtx();
  const locationId = params.id as string;

  const location = useQuery(
    api.locations.getById,
    locationId ? { id: locationId as Id<'locations'> } : 'skip'
  );

  const members = useQuery(
    api.memberships.getByOrgWithUserInfo,
    location ? { orgId: location.orgId } : 'skip'
  );

  if (orgLoading || location === undefined || members === undefined) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!location) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Location not found</p>
            <AppLink href="/settings/locations">
              <button className="text-primary hover:underline">
                Back to Locations
              </button>
            </AppLink>
          </div>
        </div>
      </Layout>
    );
  }

  // Filter members assigned to this location or org-wide access
  const activeMembers = members.filter((m) => {
    if (m.status !== 'active') return false;

    // Owner and admin with no location restrictions see all
    if ((m.role === 'owner' || m.role === 'admin') && (!m.locationIds || m.locationIds.length === 0)) {
      return true;
    }

    // Members assigned to this specific location
    return m.locationIds?.includes(locationId as Id<'locations'>);
  });

  // Count by role
  const roleCount = activeMembers.reduce((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <AppLink
            href="/settings/locations"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Locations
          </AppLink>

          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{location.name}</h1>
              <div className="mt-2 space-y-1">
                {location.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {location.address}
                  </p>
                )}
                {location.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {location.phone}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <p className="text-sm font-medium">Team Members</p>
            </div>
            <p className="text-2xl font-bold">{activeMembers.length}</p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Stethoscope className="h-4 w-4" />
              <p className="text-sm font-medium">Providers</p>
            </div>
            <p className="text-2xl font-bold">{roleCount.provider || 0}</p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              <p className="text-sm font-medium">Practice Admins</p>
            </div>
            <p className="text-2xl font-bold">{roleCount['practice-admin'] || 0}</p>
          </div>
        </div>

        {/* Team Members List */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({activeMembers.length})
          </h2>

          {activeMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No team members assigned to this location yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Assign members from the Team page
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeMembers.map((member) => {
                const role = member.role as keyof typeof ROLE_ICONS;
                const Icon = ROLE_ICONS[role] || Stethoscope;
                const label = ROLE_LABELS[role] || 'Member';
                const isOrgWide = (role === 'owner' || role === 'admin') && (!member.locationIds || member.locationIds.length === 0);

                return (
                  <div
                    key={member._id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  >
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.userName || member.userEmail || member.userId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {label}
                        {isOrgWide && ' · All locations'}
                        {member.joinedAt &&
                          ` · Joined ${new Date(member.joinedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center gap-3">
            <AppLink href="/settings/team">
              <button className="text-sm text-primary hover:underline">
                Manage Team →
              </button>
            </AppLink>
            <AppLink href="/settings/locations">
              <button className="text-sm text-primary hover:underline">
                Edit Location →
              </button>
            </AppLink>
          </div>
        </div>
      </div>
    </Layout>
  );
}
