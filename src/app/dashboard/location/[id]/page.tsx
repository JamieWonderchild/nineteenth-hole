'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import {
  MapPin,
  Users,
  FileText,
  ArrowLeft,
  Loader2,
  Calendar,
} from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

export default function LocationDetailPage() {
  const params = useParams();
  const locationId = params.id as string;
  const { orgContext, isLoading: orgLoading } = useOrgCtx();
  const [timeRange, setTimeRange] = React.useState<string>('month');

  const stats = useQuery(
    api.analytics.getLocationStats,
    locationId
      ? { locationId: locationId as Id<'locations'>, timeRange }
      : 'skip'
  );

  if (orgLoading || !stats) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const { location } = stats;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <AppLink
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </AppLink>

          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{location.name}</h1>
              {location.address && (
                <p className="text-sm text-muted-foreground">
                  {location.address}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="mb-6 flex gap-2">
          {['week', 'month', 'year', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {range === 'all'
                ? 'All Time'
                : range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-medium text-muted-foreground">
                Total Patients
              </h3>
            </div>
            <p className="text-3xl font-bold">{stats.totalPatients}</p>
          </div>

          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-medium text-muted-foreground">
                {timeRange === 'all' ? 'Total' : 'This'}{' '}
                {timeRange === 'all'
                  ? ''
                  : timeRange.charAt(0).toUpperCase() + timeRange.slice(1)}
              </h3>
            </div>
            <p className="text-3xl font-bold">{stats.consultationsInRange}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalConsultations} total encounters
            </p>
          </div>

          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-medium text-muted-foreground">
                Recent Activity
              </h3>
            </div>
            <p className="text-3xl font-bold">
              {stats.recentConsultations.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Last 10 encounters
            </p>
          </div>
        </div>

        {/* Recent Encounters */}
        {stats.recentConsultations.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">
              Recent Encounters
            </h2>
            <div className="space-y-2">
              {stats.recentConsultations.map((encounter) => (
                <AppLink
                  key={encounter._id}
                  href={`/encounter/${encounter._id}`}
                  className="block p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        Patient ID: {encounter.patientId.slice(-6)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(encounter.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted capitalize">
                      {encounter.status || 'completed'}
                    </span>
                  </div>
                </AppLink>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
