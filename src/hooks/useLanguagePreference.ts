'use client';

import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useOrgContext } from './useOrgContext';
import type { Id } from 'convex/_generated/dataModel';

export type SupportedLanguage = 'en' | 'fr';

export function useLanguagePreference() {
  const { user } = useUser();
  const { orgContext } = useOrgContext();
  const setLanguageMutation = useMutation(api.userPreferences.setLanguage);

  const prefs = useQuery(
    api.userPreferences.getUserPreferences,
    user?.id && orgContext?.orgId
      ? { userId: user.id, orgId: orgContext.orgId as Id<'organizations'> }
      : 'skip'
  );

  const language: SupportedLanguage = (prefs?.language as SupportedLanguage) ?? 'en';

  const setLanguage = async (lang: SupportedLanguage) => {
    if (!user?.id || !orgContext?.orgId) return;
    await setLanguageMutation({
      userId: user.id,
      orgId: orgContext.orgId as Id<'organizations'>,
      language: lang,
    });
  };

  return { language, setLanguage };
}
