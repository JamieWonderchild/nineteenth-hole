# Stripe Integration

## Plans

| Plan | Stripe Price | Monthly | Seats | Locations |
|------|-------------|---------|-------|-----------|
| Solo | `price_solo_...` | $79 | 1 | 1 |
| Practice | `price_practice_...` | $149 | ~5 | 1 |
| Multi-Location | `price_multi_...` | $299 | Unlimited | Unlimited |

---

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/stripe/checkout` | Create Stripe checkout session |
| `POST /api/stripe/onboarding-checkout` | Checkout during onboarding flow |
| `POST /api/stripe/portal` | Generate Stripe customer portal link |
| `POST /api/stripe/update-subscription` | Programmatic plan change |
| `POST /api/stripe/verify-session` | Verify checkout completion |
| `POST /api/stripe/webhook` | Stripe → Convex sync |

---

## Checkout Flow

```
User selects plan
  ↓
POST /api/stripe/checkout
  → creates Stripe checkout session
  → returns { url }
  ↓
Redirect to Stripe hosted checkout
  ↓
Success → redirect to /onboarding or /settings/billing
  ↓
Stripe fires checkout.session.completed webhook
  → update org plan + billingStatus in Convex
  → create Stripe customer record
```

---

## Webhook Events

All webhooks go to `POST /api/stripe/webhook`. Verified with `STRIPE_WEBHOOK_SECRET`.

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate subscription, update org plan |
| `customer.subscription.updated` | Sync plan + status changes |
| `customer.subscription.deleted` | Set billingStatus to `'canceled'` |
| `invoice.payment_failed` | Set billingStatus to `'past_due'` |

All events deduplicated via `processedWebhookEvents` table.

---

## Tax

Tax is configured per org (not in Stripe). See [database-schema.md](../architecture/database-schema.md) `organizations.taxSettings` for the tax calculation logic.

Two modes:
- **Tax-exclusive** (US, Canada): tax added on top — `total = price + price * rate/100`
- **Tax-inclusive** (EU, UK, AU): tax extracted from price — `taxAmount = price * rate/(100+rate)`

---

## Customer Portal

```
POST /api/stripe/portal
  → creates portal session for org's stripeCustomerId
  → returns { url }
  ↓
Redirect to Stripe portal (plan changes, payment method, invoices)
```

Plan changes in the portal fire `customer.subscription.updated` webhook → synced back to Convex.

---

## SDK Notes

Stripe SDK API version must match the installed package. Check `node_modules/stripe/types/lib/apiVersion.d.ts` for the expected version string.
