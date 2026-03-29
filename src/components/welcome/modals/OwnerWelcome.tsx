'use client';

import { startTransition } from 'react';
import { FeatureModal } from '@/components/ui/FeatureModal';
import { Button } from '@/components/ui/button';
import { Crown, Users, CreditCard, MapPin, ArrowRight } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

interface OwnerWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgName: string;
  isMultiLocation: boolean;
}

export function OwnerWelcomeModal({
  isOpen,
  onClose,
  orgName,
  isMultiLocation,
}: OwnerWelcomeModalProps) {
  return (
    <FeatureModal
      isOpen={isOpen}
      onClose={onClose}
      title="Welcome to your organization!"
      size="medium"
    >
      <div className="space-y-6">
        {/* Welcome Message */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Crown className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">You own {orgName}</h3>
            <p className="text-muted-foreground mt-1">
              You have full control over this organization. Manage your team, billing,
              and clinic settings from one place.
            </p>
          </div>
        </div>

        {/* Key Capabilities */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">What you can do:</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Users className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Invite and manage team members</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add providers, admins, and practice managers to your organization
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CreditCard className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Manage billing and subscriptions</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upgrade plans, update payment methods, and view invoices
                </p>
              </div>
            </div>

            {isMultiLocation && (
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Manage multiple locations</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create locations and assign team members to specific clinics
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Quick actions:</h4>
          <div className="flex flex-col gap-2">
            <AppLink
              href="/settings/team"
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              onClick={() => {
                // Use startTransition to prevent unmount errors
                startTransition(() => {
                  onClose();
                });
              }}
            >
              <span className="text-sm font-medium">Invite team members</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </AppLink>

            <AppLink
              href="/settings/billing"
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              onClick={() => {
                startTransition(() => {
                  onClose();
                });
              }}
            >
              <span className="text-sm font-medium">Manage billing</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </AppLink>

            {isMultiLocation && (
              <AppLink
                href="/settings/locations"
                className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                onClick={() => {
                  startTransition(() => {
                    onClose();
                  });
                }}
              >
                <span className="text-sm font-medium">Manage locations</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </AppLink>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="pt-4 border-t border-border">
          <Button onClick={onClose} className="w-full">
            Get Started
          </Button>
        </div>
      </div>
    </FeatureModal>
  );
}
