'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

/**
 * Hook for managing location filter state
 * Persists selection in localStorage per org
 */
export function useLocationFilter(orgId?: string) {
  const [selectedLocationId, setSelectedLocationId] = React.useState<string | null>(null);

  const locations = useQuery(
    api.locations.getByOrg,
    orgId ? { orgId: orgId as Id<'organizations'> } : 'skip'
  );

  // Load from localStorage on mount
  React.useEffect(() => {
    if (orgId) {
      const stored = localStorage.getItem(`vetai-location-filter-${orgId}`);
      if (stored) {
        setSelectedLocationId(stored);
      }
    }
  }, [orgId]);

  // Save to localStorage when changed
  const handleSetLocationId = React.useCallback(
    (locationId: string | null) => {
      setSelectedLocationId(locationId);
      if (orgId) {
        if (locationId) {
          localStorage.setItem(`vetai-location-filter-${orgId}`, locationId);
        } else {
          localStorage.removeItem(`vetai-location-filter-${orgId}`);
        }
      }
    },
    [orgId]
  );

  const selectedLocation = locations?.find((l) => l._id === selectedLocationId);

  return {
    locations: locations || [],
    selectedLocationId,
    setSelectedLocationId: handleSetLocationId,
    selectedLocation,
  };
}
