# [PRODUCT_NAME] — Documentation

## Architecture
- [Overview](architecture/overview.md) — Tech stack, system design, API surface
- [Database Schema](architecture/database-schema.md) — All Convex tables and indexes
- [Environments](architecture/environments.md) — Dev, staging, production config
- [Multi-Org & Billing](architecture/multi-org.md) — Org structure, plans, locations, Stripe
- [Navigation](architecture/navigation.md) — AppLink, useAppRouter, persistent URL params

## Integrations
- [Corti AI](integrations/corti.md) — Recording, facts, document generation, agents, gotchas
- [Clerk](integrations/clerk.md) — Auth, organizations, webhooks
- [Stripe](integrations/stripe.md) — Subscription tiers, checkout, webhooks, portal

## Features
- [Encounter Flow](features/encounter-flow.md) — Full lifecycle: record → facts → save → detail
- [Document Generation](features/document-generation.md) — 7 doc types, templates, section overrides
- [Fact Reconciliation](features/fact-reconciliation.md) — Multi-recording conflict resolution
- [Owner Companion](features/owner-companion.md) — Public AI for pet owners
- [Case Reasoning](features/case-reasoning.md) — Vet AI chat, differentials, drug interactions
- [Billing](features/billing.md) — Two-phase billing, catalog, invoice generation

## Guides
- [Getting Started](guides/getting-started.md) — Local setup for new devs
- [Deployment](guides/deployment.md) — Branch → preview → production workflow

## Demo
- [Demo Script](demo-script.md) — Full platform video walkthrough (~18 min), with 12-min cut and copy-paste dictation scripts
