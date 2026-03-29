# Architecture Overview

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Convex (real-time, serverless) |
| Auth | Clerk (+ Clerk Organizations) |
| AI | Corti AI (recording, facts, doc gen, agents) |
| Billing | Stripe |
| Deployment | Vercel |
| Domain | [PRODUCT_NAME_DOMAIN] |

## System Design

```
Browser
  ↓
Next.js App Router (Vercel)
  ├── /app/(auth)/*          — Clerk-protected pages
  ├── /app/api/*             — API routes (Next.js server)
  └── /app/companion/*       — Public companion pages (no auth)

API Routes
  ├── /api/corti/*           — Corti AI: stream, facts, diagnose, document gen, billing
  ├── /api/workflow          — Document generation pipeline
  ├── /api/case-reasoning/*  — Vet AI chat
  ├── /api/companion/*       — Owner companion creation + public access
  ├── /api/stripe/*          — Checkout, webhook, portal, subscription mgmt
  ├── /api/clerk/webhook     — Clerk → Convex org sync
  ├── /api/invitations/*     — Team invite flow
  └── /api/evidence/*        — Evidence file extraction

Convex (DB + serverless functions)
  ├── Real-time queries (useQuery)
  ├── Mutations (useMutation)
  └── File storage (evidenceFiles, Convex _storage)
```

## Data Scoping

All data is scoped to `orgId`. `providerId` is kept on records for attribution but queries always filter by org.

- **Multi-location orgs**: data further scoped by `locationId` on patients, encounters, companion sessions, and follow-ups
- **Migration**: `orgId` is optional on older tables to support legacy vet-scoped data
- **Pattern**: `useQuery(api.X.getByOrg, orgCtx ? { orgId } : 'skip')` with vet-scoped fallback

## Key Architectural Decisions

- **Diagnosis is opt-in** — vets diagnose themselves; AI assists, not leads
- **Workflow-first** — core value is document generation (SOAP, discharge, prescriptions, etc.)
- **Stateless AI** — Corti agents are ephemeral (created per session, not persistent)
- **Client-side chat history** — conversation history sent with each request; server is stateless
- **Corti-only AI** — migration from Claude/Anthropic completed March 2026; no Anthropic dependencies
