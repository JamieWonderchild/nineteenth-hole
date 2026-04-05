# Health Platform — Documentation

## Architecture
- [Overview](architecture/overview.md) — Tech stack, system design, API surface
- [Database Schema](architecture/database-schema.md) — All Convex tables and indexes
- [Environments](architecture/environments.md) — Dev, staging, production config
- [Multi-Org & Billing](architecture/multi-org.md) — Org structure, plans, locations, Stripe
- [Navigation](architecture/navigation.md) — AppLink, useAppRouter, persistent URL params
- [Ambient vs Dictation](architecture/ambient-dictation.md) — Two recording modes, two Corti endpoints

## Integrations
- [Corti AI](integrations/corti.md) — Recording, facts, document generation, agents, gotchas
- [Clerk](integrations/clerk.md) — Auth, organizations, webhooks
- [Stripe](integrations/stripe.md) — Subscription tiers, checkout, webhooks, portal

## Features
- [Consultation Flow](features/consultation-flow.md) — Full lifecycle: record → facts → save → detail
- [Ambient & Dictation](architecture/ambient-dictation.md) — Mode selection, Corti endpoints, note→facts pipeline
- [Lab Extraction](features/lab-extraction.md) — Structured lab results from spoken values
- [Medical Coding](features/medical-coding.md) — ICD-10 + CPT extraction pipeline
- [Patient Profiles](features/patient-profiles.md) — AI-built living profiles, catch-up build, list enrichment
- [Document Generation](features/document-generation.md) — 7 doc types, templates, section overrides
- [Fact Reconciliation](features/fact-reconciliation.md) — Multi-recording conflict resolution
- [Case Reasoning](features/case-reasoning.md) — AI clinical reasoning, differentials, flags
- [Patient Companion](features/owner-companion.md) — Public AI for patients and caregivers
- [Billing](features/billing.md) — Two-phase billing, catalog, invoice generation
- [Scheduling](features/scheduling.md) — Week-view calendar, appointment management

## Guides
- [Getting Started](guides/getting-started.md) — Local setup for new devs
- [Deployment](guides/deployment.md) — Branch → preview → production workflow

## Demo
- [Demo Script](demo-script.md) — Full walkthrough (~18 min) and short version (~4 min) with dialogue scripts
