'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface CompleteStepProps {
  onNext: () => void;
  onBack: () => void;
  data: any;
  setData: (data: any) => void;
}

export function CompleteStep({ data }: CompleteStepProps) {
  const router = useRouter();
  const completeSetup = useMutation(api.upgrade.completeMultiLocationSetup);

  const orgId = data.orgId as Id<'organizations'> | undefined;

  const handleComplete = async () => {
    if (!orgId) return;

    try {
      // Mark setup as complete
      await completeSetup({ orgId });

      // Redirect to locations page with success banner
      router.push('/settings/locations?setup=complete');
    } catch (error) {
      console.error('Failed to complete setup:', error);
      alert('Failed to complete setup. Please try again.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="space-y-8">
        {/* Success Icon */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Setup Complete!</h1>
          <p className="text-muted-foreground">
            Your multi-location setup is ready to go
          </p>
        </div>

        {/* Summary */}
        <div className="border rounded-lg p-6 space-y-4">
          <h3 className="font-semibold mb-2">What's Next?</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-3 w-3 text-primary" />
              </div>
              <div>
                <p className="font-medium">Manage Locations</p>
                <p className="text-muted-foreground">
                  Add, edit, or remove practice locations anytime
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-3 w-3 text-primary" />
              </div>
              <div>
                <p className="font-medium">Assign Team Members</p>
                <p className="text-muted-foreground">
                  Control which team members can access each location
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-3 w-3 text-primary" />
              </div>
              <div>
                <p className="font-medium">Location Analytics</p>
                <p className="text-muted-foreground">
                  View performance metrics for each practice location
                </p>
              </div>
            </li>
          </ul>
        </div>

        {/* Action */}
        <div className="flex justify-center">
          <Button onClick={handleComplete} size="lg">
            Go to Location Settings
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You can always access location settings from Settings → Locations
        </p>
      </div>
    </div>
  );
}
