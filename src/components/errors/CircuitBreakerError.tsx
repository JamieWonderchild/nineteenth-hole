'use client';

import { useState, useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import type { RedirectAttempt } from '@/lib/redirect-circuit-breaker';

interface CircuitBreakerErrorProps {
  breadcrumbs: RedirectAttempt[];
  remainingCooldown: number;
  onReset: () => void;
}

export function CircuitBreakerError({
  breadcrumbs,
  remainingCooldown,
  onReset,
}: CircuitBreakerErrorProps) {
  const { signOut } = useClerk();
  const [cooldown, setCooldown] = useState(remainingCooldown);
  const [showDetails, setShowDetails] = useState(false);

  // Update cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  const handleSignOut = async () => {
    await signOut({ redirectUrl: '/sign-in' });
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        {/* Error Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Setup Issue Detected</h1>
            <p className="text-muted-foreground">
              We detected a problem with your account setup that's preventing access.
            </p>
          </div>
        </div>

        {/* Error Message */}
        <div className="border rounded-lg p-6 bg-card space-y-4">
          <div className="space-y-2">
            <h2 className="font-semibold">What happened?</h2>
            <p className="text-sm text-muted-foreground">
              Your account has an incomplete organization setup. This usually happens when the initial
              setup process was interrupted.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold">What can you do?</h2>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Wait {formatTime(cooldown)} and try again</li>
              <li>Sign out and sign back in to restart the setup</li>
              <li>Contact support if the issue persists</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={onReset}
            disabled={cooldown > 0}
            size="lg"
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {cooldown > 0 ? `Try Again (${formatTime(cooldown)})` : 'Try Again'}
          </Button>

          <Button
            onClick={handleSignOut}
            variant="outline"
            size="lg"
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out and Start Fresh
          </Button>
        </div>

        {/* Technical Details (Collapsible) */}
        <div className="border rounded-lg">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg"
          >
            <span className="text-sm font-medium">Technical Details</span>
            {showDetails ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showDetails && (
            <div className="px-6 pb-4 space-y-3">
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-2">Recent redirect attempts:</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {breadcrumbs.map((attempt, idx) => (
                    <div key={idx} className="bg-muted/50 rounded p-2 font-mono">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-destructive">#{idx + 1}</span>
                        <span className="text-muted-foreground">
                          {new Date(attempt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <div>Reason: {attempt.reason}</div>
                        <div>Path: {attempt.pathname}</div>
                        <div>
                          Context: userId={attempt.context.userId ? 'present' : 'null'},
                          clerkOrgId={attempt.context.clerkOrgId || 'null'},
                          hasOrgContext={String(attempt.context.hasOrgContext)},
                          clerkOrgCount={attempt.context.clerkOrgCount}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Circuit breaker status:</strong> OPEN (too many redirects)</p>
                <p><strong>Cooldown remaining:</strong> {formatTime(cooldown)}</p>
                <p>
                  <strong>Support:</strong>{' '}
                  <a href="mailto:support@[PRODUCT_NAME_DOMAIN]" className="text-primary hover:underline">
                    support@[PRODUCT_NAME_DOMAIN]
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
