'use client';

import { FeatureModal } from '@/components/ui/FeatureModal';
import { Button } from '@/components/ui/button';
import { Stethoscope, Mic, FileText, Share2, MapPin, ArrowRight } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

interface Location {
  _id: string;
  name: string;
}

interface VetWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgName: string;
  locations: Location[];
  isLocationScoped: boolean;
}

export function VetWelcomeModal({
  isOpen,
  onClose,
  orgName,
  locations,
  isLocationScoped,
}: VetWelcomeModalProps) {
  const locationNames = locations.map((loc) => loc.name).join(', ');

  return (
    <FeatureModal
      isOpen={isOpen}
      onClose={onClose}
      title="Welcome to [PRODUCT_NAME]!"
      size="medium"
    >
      <div className="space-y-6">
        {/* Welcome Message */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Stethoscope className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Welcome to {orgName}</h3>
            <p className="text-muted-foreground mt-1">
              [PRODUCT_NAME] Assistant helps you record encounters, generate clinical documents,
              and communicate with patients—all powered by AI.
            </p>
          </div>
        </div>

        {/* Location Context */}
        {isLocationScoped && locations.length > 0 && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">
                  You&apos;re assigned to: {locationNames}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You&apos;ll only see patients and data from {locations.length === 1 ? 'this location' : 'these locations'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Getting Started Guide */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">How to use [PRODUCT_NAME]:</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Mic className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Record encounters with voice</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Start a encounter and speak naturally—AI extracts facts in real-time
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Generate clinical documents</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatically create SOAP notes, discharge instructions, prescriptions, and more
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Share2 className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Share patient companion links</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Give patients a personalized AI assistant for post-visit care and questions
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
              href="/patients"
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              onClick={onClose}
            >
              <span className="text-sm font-medium">View your patients</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </AppLink>

            <AppLink
              href="/encounters/new"
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              onClick={onClose}
            >
              <span className="text-sm font-medium">Start a new encounter</span>
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
