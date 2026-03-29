'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useUser, useOrganization, useOrganizationList } from '@clerk/nextjs';
import { Shield, ShieldCheck, Stethoscope, Building2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const ROLE_ICONS = {
  owner: ShieldCheck,
  admin: Shield,
  'practice-admin': Building2,
  provider: Stethoscope,
};

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  'practice-admin': 'Practice Admin',
  provider: 'Provider',
};

const ROLE_DESCRIPTIONS = {
  owner: 'Full access to manage the organization, team, billing, and all clinical features.',
  admin: 'Manage team members, billing, and all clinical features.',
  'practice-admin': 'Manage your location team and clinical features.',
  provider: 'Access to clinical features including encounters and patient management.',
};

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const { user, isLoaded: userLoaded } = useUser();
  const { organization, membership } = useOrganization();
  const { setActive } = useOrganizationList();

  const [accepting, setAccepting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Fetch invitation details
  const invitation = useQuery(
    api.invitations.getByToken,
    token ? { token } : 'skip'
  );

  const handleAccept = async () => {
    if (!user || !invitation || !setActive) return;

    setAccepting(true);
    setError(null);

    try {
      // First, join the Clerk organization
      await setActive({
        organization: invitation.organization?.clerkOrgId || null,
      });

      // Wait a moment for Clerk to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Accept the invitation in Convex
      const acceptedInvitation = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!acceptedInvitation.ok) {
        throw new Error('Failed to accept invitation');
      }

      setSuccess(true);

      // Redirect to dashboard after a moment
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Accept invitation error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to accept invitation. Please try again.'
      );
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (!userLoaded || invitation === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Sign In Required</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in or create an account to accept this invitation.
          </p>
          <a
            href={`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`}
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  // Invalid or expired invitation
  if (!invitation || invitation.status !== 'pending') {
    const statusMessage =
      invitation?.status === 'expired'
        ? 'This invitation has expired.'
        : invitation?.status === 'accepted'
        ? 'This invitation has already been accepted.'
        : invitation?.status === 'cancelled'
        ? 'This invitation has been cancelled.'
        : 'This invitation is no longer valid.';

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Invalid Invitation</h1>
          <p className="text-muted-foreground mb-6">{statusMessage}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome!</h1>
          <p className="text-muted-foreground mb-4">
            You've successfully joined{' '}
            <strong>{invitation.organization?.name}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  // Invitation details - ready to accept
  const role = invitation.role as keyof typeof ROLE_LABELS;
  const Icon = ROLE_ICONS[role] || Stethoscope;
  const roleLabel = ROLE_LABELS[role] || 'Member';
  const roleDescription = ROLE_DESCRIPTIONS[role] || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-blue-600 p-8 text-white text-center">
          <div className="h-16 w-16 rounded-xl bg-white flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">You're Invited!</h1>
          <p className="text-blue-100">
            Join {invitation.organization?.name} on [PRODUCT_NAME]
          </p>
        </div>

        {/* Body */}
        <div className="p-8">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">Your Role</p>
            <p className="text-lg font-semibold mb-2">{roleLabel}</p>
            <p className="text-sm text-muted-foreground">{roleDescription}</p>
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium mb-2">Invited by</p>
            <p className="text-muted-foreground">{invitation.inviterName}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800">
              ⏰ This invitation expires on{' '}
              <strong>
                {new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </strong>
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-lg font-medium hover:from-primary/90 hover:to-blue-600/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting && <Loader2 className="h-5 w-5 animate-spin" />}
            {accepting ? 'Accepting...' : 'Accept Invitation'}
          </button>

          <p className="text-xs text-center text-muted-foreground mt-4">
            By accepting, you agree to join this organization and follow its
            policies.
          </p>
        </div>
      </div>
    </div>
  );
}
