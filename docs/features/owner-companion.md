# Patient Companion

## Overview

The Patient Companion is a public-facing AI chat for patients and caregivers, accessible via a shareable link after an encounter is published. No login required — access is controlled by a token in the URL.

Inspired by PostVisit.ai.

---

## Access Model

```
Provider publishes encounter
  ↓
companionSessions record created with accessToken
  ↓
Shareable URL: [PRODUCT_NAME_DOMAIN]/companion/[accessToken]
  ↓
Patient or caregiver opens link (no auth required)
  ↓
Companion AI answers questions about the visit
```

The companion is public — anyone with the URL can access it. Links expire via `expiresAt` on the session.

---

## Session Lifecycle

1. **Creation**: Provider publishes encounter → `POST /api/companion/create`
   - Creates `companionSessions` record
   - Populates `context` from encounter facts, clinical notes, medications, follow-up plan, etc.
   - Sets `expiresAt`, `isActive: true`, `messageCount: 0`

2. **Access**: Patient/caregiver opens URL → `GET /api/companion/[id]`
   - Returns session context (no auth check, just token validation)
   - `lastAccessedAt` updated

3. **Chat**: Patient/caregiver sends message → ephemeral Corti agent created/reused
   - Agent uses `cortiAgentId` for reuse across turns (within session)
   - `cortiContextId` maintains conversation memory
   - `messageCount` incremented on each turn
   - `contextVersion` incremented when session context is updated

4. **Context Updates**: If vet updates the encounter after publishing
   - `updateSessionContext` mutation updates `context` + increments `contextVersion`
   - Companion automatically reflects updated visit info

---

## Context Object

What the owner companion knows:

```typescript
context: {
  patientName: string,
  age?: string,
  weight?: string,
  visitSummary: string,
  visitDate: string,
  diagnosis?: string,
  treatmentPlan?: string,
  medications?: [{
    name, dose, frequency, duration, instructions, startDate?, endDate?
  }],
  followUpDate?: string,
  followUpReason?: string,
  homeCareInstructions?: string[],
  warningSignsToWatch?: string[],
  dietaryInstructions?: string,
  activityRestrictions?: string,
  clinicName?: string,
  clinicPhone?: string,
  emergencyPhone?: string,
  chargedServices?: [{ description, quantity, unitPrice, total }],
}
```

---

## Corti Agent

- **One agent per session** — `cortiAgentId` reused across all turns for the same companion session
- **Stateless from server perspective** — chat history sent with each request
- **System prompt** built from the `context` object above
- Phase labels shown in companion UI correspond to `contextVersion`

---

## Print Export

Companion sessions support print export — owner can print a summary of the visit info and Q&A.

---

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/companion/create` | Create session after publish |
| `GET /api/companion/[id]` | Fetch session (token auth) |
| `POST /api/companion/[id]` | Send message, get AI response |
