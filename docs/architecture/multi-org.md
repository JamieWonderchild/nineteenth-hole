# Multi-Org Architecture

## Plans

| Plan | Price | Seats | Locations |
|------|-------|-------|-----------|
| Solo | $79/mo | 1 | 1 |
| Practice | $149/mo | Up to ~5 | 1 |
| Multi-Location | $299/mo | Unlimited | Unlimited |

---

## Data Model

```
Organization
  ├── Memberships (users + roles)
  ├── Locations (physical clinics)
  ├── BillingCatalog (price list)
  └── All clinical data (patients, encounters, etc.)
```

Every org has at least one **default location**. Multi-location orgs can have many.

---

## Roles

| Role | Access |
|------|--------|
| `owner` | Full access, billing, team management |
| `admin` | Full access except billing |
| `practice-admin` | Scoped to assigned locations |
| `vet` | Org-wide or location-scoped based on `locationIds` |

`practice-admin` and `vet` members can have `locationIds` set — they only see patients/encounters at those locations.

---

## Frontend Pattern

```tsx
// OrgContextProvider wraps the app tree
const { orgId, orgSlug, plan, billingStatus } = useOrgCtx();

// Org-scoped query (preferred)
const data = useQuery(api.patients.getByOrg, orgCtx ? { orgId } : 'skip');

// Vet-scoped fallback (legacy support)
const fallback = useQuery(api.patients.getByVet, !orgCtx ? { providerId } : 'skip');
```

---

## Clerk Integration

- Clerk Organizations maps 1:1 to `organizations` table
- Clerk webhook at `/api/clerk/webhook` syncs:
  - `organization.created` → create org + default membership
  - `organizationMembership.created/deleted` → sync membership
- `clerkOrgId` field on org links to Clerk org ID

---

## Stripe Integration

### Subscription Flow
1. User selects plan → POST `/api/stripe/checkout` → Stripe checkout session
2. Stripe webhook (`checkout.session.completed`) → update org `billingStatus` + `plan`
3. User manages billing → POST `/api/stripe/portal` → Stripe customer portal
4. Plan changes → Stripe webhook → update org, archive excess locations/members if downgrading

### Webhook Events Handled
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

### Idempotency
All webhook events are deduplicated via `processedWebhookEvents` table.

---

## BillingGuard

`<BillingGuard>` wraps features that require an active subscription. Shows upgrade prompt when `billingStatus` is not `'active'` or `'trialing'`.

---

## Settings Pages

| Page | Purpose |
|------|---------|
| `/settings` | General org settings |
| `/settings/billing` | Plan, subscription, Stripe portal |
| `/settings/team` | Invite/manage members |
| `/settings/organization` | Clinic info, locations |

---

## Plan Downgrade Handling

When downgrading (e.g., multi-location → practice):
- Excess locations get `archivedAt` + `archivedReason: 'plan_downgrade'`
- Excess memberships get `archivedAt` + `archivedReason: 'plan_downgrade'`
- `lastPlanChange` on org records the transition + whether wizard was completed
