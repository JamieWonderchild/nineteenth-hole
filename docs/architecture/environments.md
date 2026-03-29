# Environments

## Overview

Three environments: local dev, staging (Vercel preview), and production.

```
feature/* (local)
  ↓ npm run dev → localhost:3000
  ↓ merge when ready
dev branch (Vercel preview)
  ↓ auto-deploys to preview URL
  ↓ merge when tested
main branch (Vercel production)
  ↓ auto-deploys to [PRODUCT_NAME_DOMAIN]
```

---

## Environment Reference

| | Local | Staging | Production |
|--|-------|---------|-----------|
| Branch | any | `dev` | `main` |
| URL | localhost:3000 | Vercel preview URL | [PRODUCT_NAME_DOMAIN] |
| Clerk | Dev (`pk_test_...`) | Dev (`pk_test_...`) | Prod (`pk_live_...`) |
| Convex | `dev:striped-raccoon-786` | `dev:striped-raccoon-786` | `prod:charming-blackbird-181` |
| Stripe | Test keys | Test keys | Live keys |
| Corti | Same credentials everywhere | | |

---

## Service Details

### Clerk
- **Dev instance:** `outgoing-hermit-86.clerk.accounts.dev`
- **Webhook (prod):** `https://[PRODUCT_NAME_DOMAIN]/api/clerk/webhook`
- Dev/preview deployments have ephemeral URLs — webhook optional for local testing

### Convex
- **Dev:** `striped-raccoon-786.convex.cloud`
- **Prod:** `charming-blackbird-181.convex.cloud`

### Corti
- Same credentials across all environments
- Tenant: `base`, Region: `eu`
- Endpoint: `https://api.eu.corti.app`

### Stripe
- Test mode for dev/staging (`sk_test_...`)
- Live mode for production (`sk_live_...`)

---

## Local Setup

```bash
cp .env.example .env.local
# Fill in dev values
npm install
npm run dev
```

### Required env vars
```
NEXT_PUBLIC_CONVEX_URL=https://striped-raccoon-786.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
CORTI_CLIENT_ID=...
CORTI_CLIENT_SECRET=...
CORTI_TENANT=base
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## Deploy Convex Functions

```bash
# Dev
CONVEX_DEPLOYMENT=dev:striped-raccoon-786 npx convex deploy

# Production
CONVEX_DEPLOYMENT=prod:charming-blackbird-181 npx convex deploy
```

---

## Troubleshooting

**"Unauthorized" errors** — Check Clerk key matches environment (test vs live)

**Database not found** — Check `NEXT_PUBLIC_CONVEX_URL` matches environment

**Webhooks not firing** — Preview URLs change per deploy; for local testing use ngrok or skip webhook-dependent flows
