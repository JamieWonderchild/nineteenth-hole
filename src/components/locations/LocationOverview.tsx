'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { MapPin, Users, FileText, ArrowRight } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

interface LocationOverviewProps {
  orgId: string;
}

export function LocationOverview({ orgId }: LocationOverviewProps) {
  const locations = useQuery(
    api.locations.getByOrg,
    orgId ? { orgId: orgId as Id<'organizations'> } : 'skip'
  );

  const consultationCounts = useQuery(
    api.analytics.getConsultationCountsByLocation,
    orgId ? { orgId: orgId as Id<'organizations'> } : 'skip'
  );

  const patientCounts = useQuery(
    api.analytics.getPatientCountsByLocation,
    orgId ? { orgId: orgId as Id<'organizations'> } : 'skip'
  );

  if (!locations || locations.length <= 1) {
    return null; // Don't show overview for single location orgs
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Locations</h2>
        <AppLink
          href="/settings/locations"
          className="text-sm text-primary hover:underline"
        >
          Manage locations
        </AppLink>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((location) => {
          const encounters =
            consultationCounts?.find((c) => c.locationId === location._id)
              ?.count || 0;
          const patients =
            patientCounts?.find((p) => p.locationId === location._id)?.count ||
            0;

          return (
            <AppLink
              key={location._id}
              href={`/dashboard/location/${location._id}`}
              className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{location.name}</h3>
                    {location.isDefault && (
                      <span className="text-xs text-muted-foreground">
                        Default
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{patients}</p>
                    <p className="text-xs text-muted-foreground">Patients</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{encounters}</p>
                    <p className="text-xs text-muted-foreground">Consults</p>
                  </div>
                </div>
              </div>
            </AppLink>
          );
        })}
      </div>
    </div>
  );
}
