'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debugging
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-3">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            An error occurred while loading the application
          </p>
        </div>

        {/* Show error details for debugging */}
        <div className="rounded-lg bg-muted p-4 text-left">
          <p className="text-xs font-mono text-foreground break-words">
            {error.message}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Button onClick={reset} className="w-full">
            Try again
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.href = '/'}
          >
            Go to home
          </Button>
        </div>

        {/* Show stack trace in dev mode */}
        {process.env.NODE_ENV === 'development' && error.stack && (
          <details className="text-left">
            <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
              Stack trace
            </summary>
            <pre className="mt-2 text-[10px] font-mono text-muted-foreground overflow-x-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
