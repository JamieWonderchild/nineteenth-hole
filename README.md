# [PRODUCT_NAME] Assistant

AI-powered clinical encounter assistant. Streamlines the encounter workflow with voice recording, AI-extracted clinical facts, and automated document generation.

---

## What it does

- **Record encounters** — stream audio to Corti AI, get structured clinical facts in real-time
- **Generate documents** — SOAP notes, discharge instructions, prescriptions, referrals, and more
- **Patient Companion** — shareable AI chat for patients and caregivers after each visit
- **Case Reasoning** — AI-assisted differential diagnosis and drug interaction checking
- **Billing** — auto-extract billable items from recordings, catch missed charges, generate invoices

---

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Convex · Clerk · Corti AI · Stripe · Vercel

---

## Docs

See [`docs/`](docs/README.md) for full documentation:

- [Architecture Overview](docs/architecture/overview.md)
- [Database Schema](docs/architecture/database-schema.md)
- [Corti Integration](docs/integrations/corti.md)
- [Getting Started](docs/guides/getting-started.md)
- [Deployment](docs/guides/deployment.md)

---

## Quick Start

```bash
npm install
cp .env.example .env.local  # fill in dev credentials
npm run dev                  # → localhost:3000
```
