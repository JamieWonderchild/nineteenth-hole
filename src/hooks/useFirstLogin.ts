'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface UseFirstLoginOptions {
  userId: string | null | undefined;
  orgId: Id<'organizations'> | null | undefined;
  onFirstLogin?: () => void;
}

/**
 * Detect first-time user login and trigger welcome flows
 * Uses lastSeenAt field on memberships to track first login
 */
export function useFirstLogin({
  userId,
  orgId,
  onFirstLogin,
}: UseFirstLoginOptions) {
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  // Get user's membership
  const membership = useQuery(
    api.memberships.getByOrgAndUser,
    userId && orgId ? { orgId, userId } : 'skip'
  );

  const updateLastSeen = useMutation(api.memberships.updateLastSeen);

  useEffect(() => {
    if (!membership || !userId || !orgId || hasTriggered) return;

    // Check if this is first login (no lastSeenAt)
    const isFirst = !membership.lastSeenAt;
    setIsFirstLogin(isFirst);

    if (isFirst) {
      // Update lastSeenAt to prevent repeated triggers
      updateLastSeen({ membershipId: membership._id }).catch((err) => {
        console.error('Failed to update lastSeenAt:', err);
      });

      // Trigger callback
      onFirstLogin?.();
      setHasTriggered(true);
    }
  }, [membership, userId, orgId, hasTriggered, updateLastSeen, onFirstLogin]);

  return {
    isFirstLogin,
    membership,
    role: membership?.role,
    isLoading: membership === undefined,
  };
}
