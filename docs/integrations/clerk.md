# Clerk Integration

## Overview

Clerk handles authentication and organization management. Two Clerk features are used:
- **Clerk Auth** — user sign-up, sign-in, session management
- **Clerk Organizations** — multi-org support, invite flows, role management

---

## Setup

### Instances
- **Dev:** `outgoing-hermit-86.clerk.accounts.dev` (publishable key: `pk_test_...`)
- **Prod:** Live instance on `[PRODUCT_NAME_DOMAIN]` (publishable key: `pk_live_...`)

### Middleware
`src/middleware.ts` — protects all routes except:
- `/companion/*` — public owner companion pages
- `/api/companion/*` — companion API (token-based auth)
- `/api/stripe/webhook` — Stripe webhook (signature-verified)
- `/api/clerk/webhook` — Clerk webhook (signature-verified)

---

## Organization Sync

Clerk Organizations are synced to the Convex `organizations` table via webhook.

**Webhook route:** `POST /api/clerk/webhook`

### Events handled:

| Clerk Event | Convex Action |
|------------|---------------|
| `organization.created` | Create org record + default membership |
| `organization.updated` | Update org name/slug |
| `organizationMembership.created` | Create or activate membership |
| `organizationMembership.deleted` | Deactivate membership |
| `organizationInvitation.created` | (optional) sync invite |

All events are idempotent via `processedWebhookEvents` table.

---

## Frontend Usage

```tsx
// Get current org context
const { orgId, orgSlug, plan, billingStatus } = useOrgCtx();

// Org context hook (wraps OrgContextProvider)
// Lives at: src/contexts/OrgContext.tsx (or similar)
```

`OrgContextProvider` wraps the app tree and provides org data to all pages.

---

## Invite Flow

1. Admin sends invite → POST `/api/invitations/send` → creates `invitations` record + sends email
2. Invited user clicks link → GET `/invite/[token]` → validates token
3. User accepts → POST `/api/invitations/accept` → creates membership, marks invite accepted

Invites expire after 7 days. `locationIds` on invite scopes the resulting membership to specific locations (for `practice-admin` role).

---

## Roles

Roles are stored in Convex `memberships` (not in Clerk). Clerk is source of truth for auth; Convex is source of truth for roles and permissions.

| Role | Description |
|------|-------------|
| `owner` | Full access, billing, team management |
| `admin` | Full access except billing |
| `practice-admin` | Location-scoped access |
| `provider` | Standard clinical access |
