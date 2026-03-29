# Case Reasoning

## Overview

An AI-powered vet chat that lets vets reason through cases conversationally. Can be used standalone or linked to a encounter for context-aware reasoning.

Powered by Corti ephemeral agents with `contextId` for conversation memory.

---

## Features

The case reasoning chat provides:
- **Differential diagnoses** — with probability, reasoning, supporting/contradicting evidence
- **Diagnostic tests** — prioritized recommendations with rationale
- **Drug interactions** — per-species safety checks, dosing, side effects
- **Literature references** — PubMed citations (via `pubmed-expert` or `drugbank-expert`)
- **Multi-turn conversation** — vets can dig deeper, ask follow-up questions

---

## Data Model

### `caseReasoningSessions` (Convex)
Persisted chat sessions. Linked to a encounter optionally.

```typescript
{
  consultationId?: Id<"encounters">,
  providerId: string,
  orgId?: Id<"organizations">,
  cortiAgentId?: string,
  cortiContextId?: string,
  messages: [{ id, role, content, isError?, createdAt }],
  messageCount: number,
  lastMessageAt: string,
}
```

### `encounters.caseReasoning` (embedded)
Structured results stored on the encounter:
- `differentials` — differential diagnosis result + metadata
- `diagnosticTests` — test recommendations
- `drugInteractions` — medication safety analysis
- `literatureSearch` — PubMed references

---

## Architecture

```
VetChat UI
  ↓
POST /api/case-reasoning/chat
  → Clerk auth
  → Load encounter + facts from Convex
  → getOrCreateVetAgent() — reuse cortiAgentId if session exists
  → Build system prompt (5800+ chars with 19+ facts)
  → sendTextMessage() → POLL until completed
  ↓
Return response to UI
  ↓
Save message to caseReasoningSessions
```

---

## Critical: Task Polling

Corti's `sendTextMessage` returns immediately but the task is async. The code polls until completion:

```
200ms interval, max 30s timeout (~150 attempts)
```

**Never extract from a task with state `'pending'` or `'running'`.** This was the root cause of 40-60% failure rate before the fix (March 2026).

---

## Critical: No `web-search-expert`

`web-search-expert` is disabled. It causes 60s+ API hangs. Do not re-enable it.

`contextId` for conversation memory is enabled and works correctly — isolation testing proved it's reliable when used without the broken expert.

---

## Performance (Current)

| Metric | Value |
|--------|-------|
| Success rate | >95% |
| Response time | 10-12s |
| First call | ~12s (agent creation + response) |
| Subsequent calls | ~10s (agent reused) |
| Timeout budget | 60s (Vercel limit) |

---

## Experts Used

Currently: no experts enabled (all disabled due to web-search-expert causing hangs).

`pubmed-expert` and `drugbank-expert` could be enabled for literature/drug data — both have been tested and work correctly. Re-enable when ready with caution (adds 5-15s per call).

---

## API Route

`POST /api/case-reasoning/chat`

Service: `src/services/case-reasoning-chat.ts`
- `getOrCreateVetAgent()` — agent reuse logic
- `chatWithVet()` — message sending + polling
- `buildVetSystemPrompt()` — system prompt construction
