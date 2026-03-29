'use client';

import { useState, useTransition } from 'react';
import { useMutation as useConvexMutation } from 'convex/react';
import type { FunctionReference } from 'convex/server';

/**
 * Wrapper around Convex useMutation that provides immediate loading feedback
 * Uses React's useTransition for smoother UI updates
 */
export function useOptimisticMutation<Args extends Record<string, unknown>, ReturnType>(
  mutation: FunctionReference<'mutation', 'public', Args, ReturnType>
) {
  const convexMutation = useConvexMutation(mutation);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const execute = async (args: Args): Promise<ReturnType> => {
    setIsLoading(true); // Immediate feedback

    try {
      let result: ReturnType;

      // Use startTransition for smoother UI updates
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          result = await convexMutation(args as any);
          resolve();
        });
      });

      return result!;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    mutate: execute,
    isLoading: isLoading || isPending,
  };
}
