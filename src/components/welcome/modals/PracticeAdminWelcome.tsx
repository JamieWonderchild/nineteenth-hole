'use client';

import { FeatureModal } from '@/components/ui/FeatureModal';
import { Button } from '@/components/ui/button';
import { MapPin, Users, Stethoscope, ArrowRight } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

interface Location {
  _id: string;
  name: string;
}

interface PracticeAdminWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgName: string;
  locations: Location[];
}

export function PracticeAdminWelcomeModal({
  isOpen,
  onClose,
  orgName,
  locations,
}: PracticeAdminWelcomeModalProps) {
  const locationNames = locations.map((loc) => loc.name).join(', ');
  const locationCount = locations.length;

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
          <div className="p-2 bg-green-500/10 rounded-lg">
            <MapPin className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              You manage {locationCount === 1 ? 'a location' : 'locations'} at {orgName}
            </h3>
            <p className="text-muted-foreground mt-1">
              You have management access to specific clinic{locationCount > 1 ? 's' : ''}.
              You can manage your team and access all clinical features for assigned locations.
            </p>
          </div>
        </div>

        {/* Assigned Locations */}
        {locations.length > 0 ? (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Your assigned locations:</p>
            <div className="flex flex-wrap gap-2">
              {locations.map((loc) => (
                <div
                  key={loc._id}
                  className="px-3 py-1.5 bg-background border border-border rounded-full text-sm"
                >
                  {loc.name}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No locations assigned yet. Contact your organization owner to assign you to locations.
            </p>
          </div>
        )}

        {/* Key Capabilities */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">What you can do:</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Users className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Manage your team</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Invite and manage providers at your assigned location{locationCount > 1 ? 's' : ''}
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
              href="/settings/team"
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              onClick={onClose}
            >
              <span className="text-sm font-medium">Manage your team</span>
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
