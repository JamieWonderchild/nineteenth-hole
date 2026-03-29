# Navigation Architecture

## Problem

Admin/impersonation flows use persistent URL params (e.g., `?assume=org_id`). Standard Next.js `Link` and `useRouter` drop these params on navigation.

## Solution

Custom navigation layer that automatically preserves specified params across all navigation.

---

## Core Components

### `AppLink` — `src/components/navigation/AppLink.tsx`
Drop-in replacement for Next.js `Link`. Automatically injects persistent params into `href`.

```tsx
// Use this everywhere instead of <Link>
import { AppLink } from '@/components/navigation/AppLink';

<AppLink href="/patients">Patients</AppLink>
// renders as /patients?assume=org_123 if assume param is present

// Opt out when needed (legal pages, onboarding)
<AppLink href="/terms" preserveParams={false}>Terms</AppLink>
```

### `useAppRouter` — `src/hooks/useAppRouter.ts`
Drop-in replacement for `useRouter`. Wraps `router.push/replace` to inject persistent params.

```tsx
import { useAppRouter } from '@/hooks/useAppRouter';

const router = useAppRouter();
router.push('/encounter/123'); // auto-injects ?assume=... if present
```

### `NavigationProvider` — `src/contexts/NavigationContext.tsx`
Wraps the app tree. Reads current URL params, identifies which ones are persistent, and provides `buildUrl(path)` to any component.

---

## Persistent Params

Defined in `src/types/navigation.ts` as `PersistentParams` interface. Currently: `assume` (org impersonation).

---

## Rules

- Always use `AppLink` instead of `<Link>`
- Always use `useAppRouter()` instead of `useRouter()`
- `LoadingLink` internally uses `AppLink` — no changes needed
- **Never** use `useAssumeParam` hook — removed, replaced by automatic preservation
- Opt out with `preserveParams={false}` only for: auth pages, legal pages, onboarding flows
