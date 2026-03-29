'use client';

import { FeatureModal } from '@/components/ui/FeatureModal';
import { Button } from '@/components/ui/button';
import { Shield, Users, BarChart3, Stethoscope, ArrowRight } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

interface AdminWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgName: string;
}

export function AdminWelcomeModal({
  isOpen,
  onClose,
  orgName,
}: AdminWelcomeModalProps) {
  return (
    <FeatureModal
      isOpen={isOpen}
      onClose={onClose}
      title="Welcome to the team!"
      size="medium"
    >
      <div className="space-y-6">
        {/* Welcome Message */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Shield className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">You&apos;re an admin at {orgName}</h3>
            <p className="text-muted-foreground mt-1">
              You have full access to all features and locations across the organization,
              except billing management.
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
                <p className="font-medium text-sm">Manage team members</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Invite and assign roles to providers and practice managers
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <BarChart3 className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Access all locations</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View and manage patients, encounters, and data across all clinics
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Stethoscope className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Full clinical access</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record encounters, generate documents, and manage patient care
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Get started:</h4>
          <div className="flex flex-col gap-2">
            <AppLink
              href="/dashboard"
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              onClick={onClose}
            >
              <span className="text-sm font-medium">View dashboard</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </AppLink>

            <AppLink
              href="/settings/team"
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              onClick={onClose}
            >
              <span className="text-sm font-medium">Manage team</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </AppLink>

            <AppLink
              href="/patients"
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              onClick={onClose}
            >
              <span className="text-sm font-medium">Start working with patients</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </AppLink>
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
