'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2, Hospital } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

export default function FhirLaunchPage() {
  const searchParams = useSearchParams();
  const connected = searchParams.get('connected') === '1';
  const error = searchParams.get('error');
  const patientId = searchParams.get('patient');
  const encounterId = searchParams.get('encounter');
  const [isConnecting, setIsConnecting] = useState(false);

  // If this page is opened as an EHR-embedded SMART launch,
  // Epic will hit /api/fhir/launch directly. This page is the
  // standalone "Connect to Epic" destination shown to providers.

  useEffect(() => {
    if (connected) {
      // Auto-close this tab if it was opened as a popup
      if (window.opener) {
        window.opener.postMessage({ type: 'fhir-connected', patientId, encounterId }, '*');
        window.close();
      }
    }
  }, [connected, patientId]);

  const handleConnect = () => {
    setIsConnecting(true);
    // Redirect to the SMART launch handler (standalone — no EHR launch= param)
    window.location.href = '/api/fhir/launch';
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Connection Failed</h1>
            <p className="text-sm text-muted-foreground">{decodeURIComponent(error)}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleConnect} disabled={isConnecting} className="gap-2">
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Hospital className="h-4 w-4" />
              )}
              Try Again
            </Button>
            <AppLink href="/dashboard">
              <Button variant="ghost" className="w-full">Back to Dashboard</Button>
            </AppLink>
          </div>
        </div>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Connected to Epic</h1>
            <p className="text-sm text-muted-foreground">
              You can now push notes and pull patient demographics directly from Epic.
              {patientId && ` Patient context loaded.`}
            </p>
          </div>
          <AppLink href="/encounter">
            <Button className="gap-2">
              <Hospital className="h-4 w-4" />
              Go to Encounters
            </Button>
          </AppLink>
        </div>
      </div>
    );
  }

  // Default: "Connect to Epic" landing
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
            <Hospital className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-xl font-semibold">Connect to Epic</h1>
          <p className="text-sm text-muted-foreground">
            Link your Epic account to push generated notes directly into the EHR
            and pull patient demographics for faster documentation.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            What this enables
          </p>
          <ul className="space-y-2 text-sm">
            {[
              'Push SOAP notes and discharge summaries to Epic',
              'Pre-fill patient demographics from Epic on encounter creation',
              'Link notes to the correct encounter in the EHR',
              'Supports Epic App Orchard SMART on FHIR R4',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <Button
            className="w-full gap-2"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Hospital className="h-4 w-4" />
            )}
            Connect to Epic
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Uses SMART on FHIR OAuth 2.0 with PKCE. Your credentials are never stored.
          </p>
        </div>
      </div>
    </div>
  );
}
