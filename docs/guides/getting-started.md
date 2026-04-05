# Getting Started

## Prerequisites

- Node.js 18+
- npm
- Access to: Convex, Clerk, Corti, Stripe (ask team for dev credentials)

---

## Setup

```bash
git clone https://github.com/JamieWonderchild/health-platform.git
cd health-platform
npm install
cp .env.example .env.local
```

Fill in `.env.local` with dev credentials (ask team). See [environments.md](../architecture/environments.md) for the full list of required variables.

```bash
npm run dev
# → http://localhost:3000
```

---

## Key Directories

```
src/
  app/                  Next.js App Router pages + API routes
    api/                API routes (corti, workflow, stripe, clerk, companion, etc.)
    (auth)/             Clerk-protected pages
    companion/          Public companion pages
  components/           React components
    ui/                 shadcn/ui primitives
    navigation/         AppLink, LoadingLink
    case-reasoning/     CaseReasoning component
    encounter/       Recording, WorkflowPanel, EvidenceUpload, etc.
  contexts/             OrgContext, NavigationContext
  hooks/                useOrgCtx, useAppRouter, useBillingMatcher, etc.
  lib/                  Utilities, CortiClient, superadmin check
  services/             Business logic (case-reasoning-chat.ts)
  types/                TypeScript interfaces

convex/                 Database schema + serverless functions
  schema.ts             Source of truth for all DB tables
  *.ts                  Queries and mutations by domain
```

---

## Convex

Schema changes are made in `convex/schema.ts`. After changing the schema:
```bash
npx convex dev   # auto-generates api.d.ts types
```

Types are auto-generated — never edit `convex/_generated/` manually.

**Id casting:** Use `as Id<"tableName">` — not `ReturnType<typeof api...>`.

---

## Navigation

Always use `AppLink` and `useAppRouter` instead of Next.js `Link` and `useRouter`. These preserve persistent URL params (e.g., `?assume=`) automatically.

```tsx
import { AppLink } from '@/components/navigation/AppLink';
import { useAppRouter } from '@/hooks/useAppRouter';
```

---

## Corti

The Corti client lives in `src/lib/corti-client.ts` (or similar). Key things to know:
- Audio chunks must be sent at 200ms intervals
- Always poll tasks until `state === 'completed'`
- Never use `web-search-expert` — it causes API hangs

See [integrations/corti.md](../integrations/corti.md) for full reference.

---

## Onboarding Flow

New users go through a single-step onboarding (Practice Name + Your Name). Everyone starts on the Practice plan in trial (14 days).

Superadmins (`jar@corti.ai`, `jamie.aronson00@gmail.com`) auto-activate with `billingStatus: 'active'` and never hit the paywall. See `src/lib/superadmin.ts`.
