# Deployment

## Branch → Environment Mapping

| Branch | Environment | URL |
|--------|-------------|-----|
| `feature/*` | Local only | localhost:3000 |
| `dev` | Vercel Preview | auto-generated URL |
| `main` | Production | [PRODUCT_NAME_DOMAIN] |

---

## Standard Workflow

```bash
# 1. Work on a feature branch
git checkout -b feature/your-feature
# ... make changes ...
git commit -m "feat: ..."

# 2. Merge to dev for staging test
git checkout dev
git merge feature/your-feature
git push origin dev
# Vercel auto-deploys to preview URL

# 3. When tested, merge to main
git checkout main
git merge dev
git push origin main
# Vercel auto-deploys to [PRODUCT_NAME_DOMAIN]
```

---

## Convex Deployments

Convex functions deploy separately from the Next.js app.

```bash
# Deploy to dev Convex
CONVEX_DEPLOYMENT=dev:striped-raccoon-786 npx convex deploy

# Deploy to production Convex
CONVEX_DEPLOYMENT=prod:charming-blackbird-181 npx convex deploy
```

**When to redeploy Convex:**
- Schema changes (`convex/schema.ts`)
- New/changed mutations or queries
- New Convex action/function files

---

## Environment Variables

Environment variables are managed in Vercel:
- **Preview** environment → `dev` branch and PRs
- **Production** environment → `main` branch

See [environments.md](../architecture/environments.md) for the full variable list.

---

## Stripe Webhooks

Stripe webhook must point to the right URL per environment:
- **Production:** `https://[PRODUCT_NAME_DOMAIN]/api/stripe/webhook`
- **Preview:** Needs manual update per preview URL (or use Stripe CLI for local testing)

```bash
# Local Stripe webhook testing
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Clerk Webhooks

- **Production webhook:** `https://[PRODUCT_NAME_DOMAIN]/api/clerk/webhook`
- Preview deployments have ephemeral URLs — webhook optional for local testing
- Missing webhook won't break existing data; only affects org sync on new events

---

## Checklist Before Merging to Main

- [ ] Tested on `dev` preview URL
- [ ] Convex schema changes deployed to prod Convex
- [ ] No TypeScript errors (`npm run build`)
- [ ] Stripe and Clerk webhooks pointing to correct URL
- [ ] Env vars in Vercel production are up to date
