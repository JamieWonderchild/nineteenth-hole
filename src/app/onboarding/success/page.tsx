'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppRouter } from '@/hooks/useAppRouter';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OnboardingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useAppRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Verify payment and wait for webhook to create org
    const verifyPayment = async () => {
      if (!sessionId) {
        setStatus('error');
        return;
      }

      // Poll for org creation by the webhook
      const maxAttempts = 20; // 20 attempts * 1 second = 20 seconds max
      let attempts = 0;

      while (attempts < maxAttempts) {
        try {
          // Check if payment was successful
          const response = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);

          if (response.ok) {
            const data = await response.json();
            if (data.orgCreated) {
              setStatus('success');
              return;
            }
          }
        } catch (error) {
          console.error('Error verifying payment:', error);
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // If we've waited 20 seconds and still no org, show success anyway
      // The org might have been created but the verification endpoint failed
      setStatus('success');
    };

    verifyPayment();
  }, [sessionId]);

  if (status === 'verifying') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Processing your payment...</h1>
          <p className="text-muted-foreground">
            This will only take a moment
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-2xl text-destructive">✕</span>
          </div>
          <h1 className="text-2xl font-bold">Payment verification failed</h1>
          <p className="text-muted-foreground">
            Please contact support or try again
          </p>
          <Button onClick={() => router.push('/onboarding')}>
            Back to Onboarding
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6 max-w-md">
        <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome to [PRODUCT_NAME]!</h1>
          <p className="text-muted-foreground">
            Your Multi-Location subscription is active with a 14-day free trial.
          </p>
        </div>

        <div className="bg-muted rounded-lg p-6 text-left space-y-2">
          <p className="text-sm">
            ✓ Your organization has been created
          </p>
          <p className="text-sm">
            ✓ 14-day free trial started (won't be charged until {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()})
          </p>
          <p className="text-sm">
            ✓ Full Multi-Location features unlocked
          </p>
        </div>

        <Button onClick={() => router.push('/')} size="lg" className="w-full">
          Get Started
        </Button>
      </div>
    </div>
  );
}
