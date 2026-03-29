'use client';

import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { AppLink } from '@/components/navigation/AppLink';
import { SetupStatusCard } from '@/components/settings/SetupStatusCard';
import { PostUpgradeWizard } from '@/components/upgrade/PostUpgradeWizard';
import {
  CreditCard,
  Users,
  Building2,
  ChevronRight,
  Shield,
  Loader2,
  MapPin,
  Tag,
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

const settingsLinks = [
  {
    href: '/settings/organization',
    label: 'Organization',
    description: 'Practice name and contact information',
    icon: Building2,
  },
  {
    href: '/settings/locations',
    label: 'Locations',
    description: 'Manage practice locations and addresses',
    icon: MapPin,
  },
  {
    href: '/settings/team',
    label: 'Team',
    description: 'Invite providers, manage roles and permissions',
    icon: Users,
  },
  {
    href: '/settings/billing',
    label: 'Subscription',
    description: 'Plan, usage, and subscription management',
    icon: CreditCard,
    adminOnly: true,
  },
  {
    href: '/settings/billing-preferences',
    label: 'Billing Preferences',
    description: 'Tax settings and client billing configuration',
    icon: Tag,
  },
];

export default function SettingsPage() {
  const { orgContext, isLoading, error } = useOrgCtx();
  const { user } = useUser();
  const markSettingsViewed = useMutation(api.userPreferences.markSettingsViewed);
  const [showWizard, setShowWizard] = useState(false);

  // Get upgrade state to show setup card and wizard
  const upgradeState = useQuery(
    api.upgrade.getUpgradeState,
    orgContext?.orgId ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  // Auto-show wizard if upgrade state indicates it should show
  useEffect(() => {
    if (upgradeState?.showWizard && !showWizard) {
      setShowWizard(true);
    }
  }, [upgradeState?.showWizard, showWizard]);

  // Track which links are being hovered for prefetching
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  // Prefetch queries based on hovered link
  const orgId = orgContext?.orgId as Id<'organizations'> | undefined;

  // These queries will run when hoveredLink matches, warming up the cache
  useQuery(
    api.memberships.getByOrg,
    hoveredLink === '/settings/team' && orgId ? { orgId } : 'skip'
  );
  useQuery(
    api.providers.getProvidersByOrg,
    hoveredLink === '/settings/team' && orgId ? { orgId } : 'skip'
  );
  useQuery(
    api.locations.getByOrg,
    hoveredLink === '/settings/locations' && orgId ? { orgId } : 'skip'
  );
  useQuery(
    api.organizations.getById,
    hoveredLink === '/settings/organization' && orgId ? { id: orgId } : 'skip'
  );

  // Auto-dismiss setup banner when user visits settings
  useEffect(() => {
    if (orgContext?.orgId && user?.id) {
      markSettingsViewed({
        userId: user.id,
        orgId: orgContext.orgId as Id<'organizations'>,
      }).catch(console.error);
    }
  }, [orgContext?.orgId, user?.id, markSettingsViewed]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (error || !orgContext) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-2">
            <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h2 className="text-lg font-semibold">No organization found</h2>
            <p className="text-sm text-muted-foreground">
              {error || 'Set up your practice to access settings.'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your practice, team, and billing
          </p>
        </div>

        {/* Setup Status Card */}
        {orgContext && user && upgradeState?.plan === 'multi-location' && (
          <SetupStatusCard
            orgId={orgContext.orgId as Id<'organizations'>}
            userId={user.id}
            setupState={upgradeState.setupState}
          />
        )}

        {orgContext && (
          <>
            <div className="mb-6 flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{orgContext.name}</p>
                <p className="text-sm text-muted-foreground">
                  {orgContext.plan === 'solo'
                    ? 'Solo Provider'
                    : orgContext.plan === 'practice'
                      ? 'Practice'
                      : 'Multi-Location'}{' '}
                  plan
                  {orgContext.billingStatus === 'trialing' && (
                    <span className="ml-1 text-green-600">(Trial)</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                {orgContext.role}
              </div>
            </div>

          </>
        )}

        <div className="space-y-2">
          {settingsLinks
            .filter(
              (link) => !link.adminOnly || orgContext?.isAdmin
            )
            .map((link) => {
              const Icon = link.icon;
              return (
                <AppLink
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent transition-colors group"
                  onMouseEnter={() => setHoveredLink(link.href)}
                  onMouseLeave={() => setHoveredLink(null)}
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{link.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </AppLink>
              );
            })}
        </div>
      </div>

      {/* Post-Upgrade Wizard Modal */}
      {showWizard && orgContext && user && (
        <PostUpgradeWizard
          orgId={orgContext.orgId as Id<'organizations'>}
          userId={user.id}
          onClose={() => setShowWizard(false)}
        />
      )}
    </Layout>
  );
}
