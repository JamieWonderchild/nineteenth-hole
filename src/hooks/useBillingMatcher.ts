import { useMemo } from 'react';
import Fuse from 'fuse.js';

// Simplified fact type (id, text, group)
export interface SimpleFact {
  id: string;
  text: string;
  group: string;
}

export interface BillingCatalogItem {
  _id: string;
  name: string;
  code: string;
  category: string;
  basePrice: number;
  taxable: boolean;
  description?: string;
}

export interface BillingMatch {
  fact: SimpleFact;
  bestMatch: BillingCatalogItem | null;
  confidence: 'high' | 'medium' | 'low';
  score: number;
}

/**
 * Hook to fuzzy match billing facts to catalog items
 *
 * @param facts - All facts from encounter recordings
 * @param catalog - Organization's billing catalog
 * @returns Array of matches with confidence scores
 */
export function useBillingMatcher(
  facts: SimpleFact[] | undefined,
  catalog: BillingCatalogItem[] | undefined
): BillingMatch[] {
  return useMemo(() => {
    if (!facts || !catalog || catalog.length === 0) {
      return [];
    }

    // Filter to billing-related facts only
    const billingFacts = facts.filter((fact) =>
      fact.group?.startsWith('billing-')
    );

    if (billingFacts.length === 0) {
      return [];
    }

    // Initialize Fuse.js with multi-field matching
    const fuse = new Fuse(catalog, {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'description', weight: 0.3 },
        { name: 'code', weight: 0.2 },
      ],
      threshold: 0.6, // Max distance (0=exact, 1=match anything)
      includeScore: true,
      ignoreLocation: true, // Match anywhere in string
      minMatchCharLength: 3, // Require at least 3 chars matching
    });

    // Match each billing fact
    return billingFacts.map((fact) => {
      const results = fuse.search(fact.text);
      const topResult = results[0];

      return {
        fact,
        bestMatch: topResult?.item || null,
        confidence: calculateConfidence(topResult?.score),
        score: topResult?.score ?? 1,
      };
    });
  }, [facts, catalog]);
}

/**
 * Calculate confidence level from Fuse.js score
 * Lower scores = better matches
 */
function calculateConfidence(score: number | undefined): 'high' | 'medium' | 'low' {
  if (score === undefined) return 'low';

  if (score < 0.3) return 'high';
  if (score < 0.5) return 'medium';
  return 'low';
}
