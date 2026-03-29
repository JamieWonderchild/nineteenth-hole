'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface UseWizardStateOptions {
  wizardId: string;
  userId: string | null | undefined;
  orgId: Id<'organizations'> | null | undefined;
  totalSteps: number;
  autoSave?: boolean;
  onComplete?: () => void;
}

/**
 * Manage wizard state with automatic progress saving and resume capability
 */
export function useWizardState({
  wizardId,
  userId,
  orgId,
  totalSteps,
  autoSave = true,
  onComplete,
}: UseWizardStateOptions) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<any>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved progress
  const savedProgress = useQuery(
    api.userPreferences.getWizardProgress,
    userId && orgId ? { userId, orgId, wizardId } : 'skip'
  );

  const saveProgress = useMutation(api.userPreferences.saveWizardProgress);
  const clearProgress = useMutation(api.userPreferences.clearWizardProgress);

  // Initialize from saved progress on mount
  useEffect(() => {
    if (savedProgress && !isInitialized) {
      setCurrentStep(savedProgress.currentStep);
      setData(savedProgress.data || {});
      setIsInitialized(true);
    } else if (!savedProgress && !isInitialized) {
      setIsInitialized(true);
    }
  }, [savedProgress, isInitialized]);

  // Auto-save progress when step or data changes
  useEffect(() => {
    if (!autoSave || !isInitialized || !userId || !orgId) return;

    const timer = setTimeout(() => {
      saveProgress({
        userId,
        orgId,
        wizardId,
        currentStep,
        data,
      });
    }, 500); // Debounce saves

    return () => clearTimeout(timer);
  }, [currentStep, data, autoSave, isInitialized, userId, orgId, wizardId, saveProgress]);

  const goToNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Wizard complete
      if (userId && orgId) {
        clearProgress({ userId, orgId });
      }
      onComplete?.();
    }
  }, [currentStep, totalSteps, userId, orgId, clearProgress, onComplete]);

  const goToBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    }
  }, [totalSteps]);

  const updateData = useCallback((newData: any) => {
    setData((prev: any) => ({ ...prev, ...newData }));
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setData({});
    if (userId && orgId) {
      clearProgress({ userId, orgId });
    }
  }, [userId, orgId, clearProgress]);

  const complete = useCallback(() => {
    if (userId && orgId) {
      clearProgress({ userId, orgId });
    }
    onComplete?.();
  }, [userId, orgId, clearProgress, onComplete]);

  return {
    currentStep,
    data,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
    progress: ((currentStep + 1) / totalSteps) * 100,
    hasResumableProgress: !!savedProgress,
    isInitialized,

    // Actions
    goToNext,
    goToBack,
    goToStep,
    updateData,
    setData,
    reset,
    complete,
  };
}
