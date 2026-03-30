'use client';

import React, { useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PlusCircle,
  Users,
  Activity,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  Mic,
  ArrowRight,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { useAppRouter } from '@/hooks/useAppRouter';
import { AppLink } from '@/components/navigation/AppLink';
import { LandingPage } from '@/components/landing/LandingPage';
import { FAB } from '@/components/ui/fab';
import { useIsMobile } from '@/hooks/useIsMobile';
import { LocationOverview } from '@/components/locations/LocationOverview';
import { SubtleSetupBanner } from '@/components/banners/SubtleSetupBanner';
import { BillingGuard } from '@/components/billing/BillingGuard';


function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  }
  const months = Math.floor(diffDays / 30);
  return `${months}mo ago`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color?: 'primary' | 'green' | 'blue' | 'amber';
}

function StatCard({ label, value, icon: Icon, color = 'primary' }: StatCardProps) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  review: { label: 'Review', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  published: { label: 'Published', className: 'bg-green-50 text-green-700 border-green-200' },
};

const PENDING_STATUSES = new Set(['draft', 'in-progress', 'review']);

export default function Home() {
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const { userId, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { orgContext, isLoading: orgLoading } = useOrgCtx();
  const isMobile = useIsMobile();
  const [showWelcome, setShowWelcome] = React.useState(
    searchParams.get('onboarding') === 'success'
  );

  const upgradeState = useQuery(
    api.upgrade.getUpgradeState,
    orgContext ? { orgId: orgContext.orgId as Id<"organizations"> } : 'skip'
  );
  const isSetupBannerDismissed = useQuery(
    api.userPreferences.isBannerDismissed,
    orgContext && userId
      ? { orgId: orgContext.orgId as Id<"organizations">, userId, bannerId: 'multi-location-setup' }
      : 'skip'
  );

  const showSetupBanner =
    orgContext?.plan === 'multi-location' &&
    upgradeState?.setupState?.locationSetupCompleted === false &&
    !isSetupBannerDismissed;

  const orgConsultations = useQuery(
    api.encounters.getConsultationsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<"organizations"> } : 'skip'
  );
  const vetConsultations = useQuery(
    api.encounters.getVetConsultations,
    !orgContext && userId ? { userId } : 'skip'
  );
  const encounters = orgConsultations ?? vetConsultations;

  const orgPatients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<"organizations"> } : 'skip'
  );
  const vetPatients = useQuery(
    api.patients.getPatientsByVet,
    !orgContext && userId ? { providerId: userId } : 'skip'
  );
  const patients = orgPatients ?? vetPatients;

  const stats = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);

    const totalPatients = patients?.length ?? 0;
    const thisWeek = encounters?.filter((c) => new Date(c.date) >= oneWeekAgo).length ?? 0;
    const thisMonth = encounters?.filter((c) => new Date(c.date) >= oneMonthAgo).length ?? 0;
    const avgPerWeek = thisMonth > 0 ? Math.round(thisMonth / 4) : 0;

    return { totalPatients, thisWeek, thisMonth, avgPerWeek };
  }, [encounters, patients]);

  const pendingConsultations = useMemo(() => {
    if (!encounters || !patients) return [];
    const patientMap = new Map(patients.map((p) => [p._id, p]));
    return [...encounters]
      .filter((c) => c.status && PENDING_STATUSES.has(c.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((c) => {
        const patient = patientMap.get(c.patientId);
        return {
          id: c._id,
          patientName: patient?.name ?? c.extractedPatientInfo?.name ?? 'Unknown',
          status: c.status,
          reasonForVisit: c.reasonForVisit,
          date: c.createdAt,
        };
      });
  }, [encounters, patients]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSignedIn) return <LandingPage />;

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!orgContext) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <BillingGuard feature="Dashboard">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

          {showSetupBanner && orgContext && userId && (
            <SubtleSetupBanner
              orgId={orgContext.orgId as Id<"organizations">}
              userId={userId}
            />
          )}

          {showWelcome && (
            <div className="relative bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Welcome to [PRODUCT_NAME]!</p>
                  <p className="text-sm text-muted-foreground">
                    Your practice is all set. Start by creating your first encounter.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWelcome(false)}
                className="text-muted-foreground hover:text-foreground text-sm px-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Greeting + CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {getGreeting()}, {user?.firstName ?? 'Provider'}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Here&apos;s your practice overview
              </p>
            </div>
            <Button onClick={() => router.push('/encounter')} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              New Encounter
            </Button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Patients" value={stats.totalPatients} icon={Users} color="blue" />
            <StatCard label="This Week" value={stats.thisWeek} icon={Activity} color="green" />
            <StatCard label="This Month" value={stats.thisMonth} icon={Calendar} color="primary" />
            <StatCard label="Avg / Week" value={stats.avgPerWeek} icon={TrendingUp} color="amber" />
          </div>

          {/* Location Overview (multi-location orgs only) */}
          {orgContext?.plan === 'multi-location' && orgContext.orgId && (
            <LocationOverview orgId={orgContext.orgId} />
          )}

          {/* Needs Attention */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Needs Attention</CardTitle>
                {encounters !== undefined && pendingConsultations.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {pendingConsultations.length}
                  </Badge>
                )}
              </div>
              <AppLink
                href="/encounter"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                All encounters <ArrowRight className="h-3 w-3" />
              </AppLink>
            </CardHeader>
            <CardContent>
              {encounters === undefined ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : pendingConsultations.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-green-500/60 mb-3" />
                  <p className="text-sm font-medium">All caught up</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No drafts or encounters awaiting review
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {pendingConsultations.map((c) => {
                    const statusCfg = c.status ? STATUS_CONFIG[c.status] : null;
                    return (
                      <AppLink
                        key={c.id}
                        href={`/encounter/${c.id}`}
                        className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-base">
                          <span className="text-sm font-medium text-primary">
                            {c.patientName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.patientName}</p>
                          {c.reasonForVisit ? (
                            <p className="text-xs text-muted-foreground truncate">{c.reasonForVisit}</p>
                          ) : null}
                        </div>
                        {statusCfg && (
                          <Badge variant="outline" className={`text-xs flex-shrink-0 ${statusCfg.className}`}>
                            {statusCfg.label}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatRelativeDate(c.date)}
                        </span>
                      </AppLink>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Mobile FAB - Quick Record */}
        {isMobile && isSignedIn && (
          <FAB
            onClick={() => router.push('/encounter/new?mobile=true')}
            aria-label="Start recording"
          >
            <Mic className="h-6 w-6" />
          </FAB>
        )}
      </BillingGuard>
    </Layout>
  );
}
