# Corti AI Integration

## Overview

Corti is the sole AI provider. It handles:
- Audio recording → transcription → fact extraction (streaming)
- Document generation (SOAP, discharge, prescriptions, etc.)
- Agentic AI (case reasoning, owner companion, billing extraction)

Base URL: `https://api.eu.corti.app`

---

## Recording & Facts

### Flow
1. Browser streams audio chunks to `/api/corti/stream`
2. Corti returns transcript + facts in real-time via SSE
3. Facts saved to `recordings` table on completion
4. Facts aggregated to `encounters.facts` on save

### Critical: Chunk Interval
Audio must be chunked at **200ms intervals** (not 500ms). 500ms causes lossy/incomplete fact extraction.

### Fact Structure
```typescript
interface Fact {
  id: string;
  text: string;
  group: string; // e.g. 'history', 'exam', 'assessment', 'billing-procedure'
}
```

---

## Document Generation

### Endpoint
`POST /v2/interactions/{interactionId}/documents`

Via `CortiClient.generateDocumentRaw()`.

### Context Rule
**Context array MUST have exactly 1 entry:**
```typescript
context: [{ type: 'facts', data: SimplifiedFact[] }]
```
Vet notes/diagnosis go as additional facts with `source: 'user'`. Sending raw transcript bypasses Corti's section routing — always use facts.

### Template Keys

| Doc Type | Template Key | Source |
|----------|-------------|--------|
| SOAP Note | `corti-soap` | Corti default |
| All others | — | Section overrides only |

Default Corti section keys: `corti-subjective`, `corti-objective`, `corti-assessment`, `corti-plan`, `corti-patient-summary`, `corti-referral`

### Template Strategy
- **SOAP**: `corti-soap` templateKey — the only Corti template in active use
- **Everything else**: Runtime section assembly with `corti-*` section overrides

Custom Directus templates (`vetai-*`) were attempted but abandoned — all failed with either "missing content" errors in routed_parallel mode or 500s. Section overrides produce better output.

### Section Override Fields
Runtime customization of any section:

```typescript
{
  nameOverride: string,
  contentOverride: string,        // Controls fact routing (Include:/Exclude: format)
  writingStyleOverride: string,   // Dropdown in Directus — put descriptions in prompt instead
  formatRuleOverride: string,
  additionalInstructionsOverride: string,
}
```

**Important:** Overrides **replace** defaults entirely — not additive. Set all fields you need.

The `contentOverride` field is critical for fact routing. Without it, Corti skips routing and sends all facts to all sections.

---

## Ephemeral Agents

Used for: case reasoning, owner companion, billing extraction.

### Creating an Agent
```typescript
POST /agents
{
  type: 'ephemeral',
  systemPrompt: string,
  experts: ExpertReference[], // see expert registry
  contextId?: string,         // for conversation memory
}
```

### Expert Registry
```
GET /agents/registry/experts  (NOT /agents/experts)
```

Available experts (use `-expert` suffix):
- `memory-expert`
- `posos-expert`
- `clinical-trials-expert`
- `drugbank-expert`
- `pubmed-expert`
- `web-search-expert` ← **BROKEN — never use** (causes 60s+ hangs)
- `medical-calculator-expert`
- `coding-expert`
- `interviewing-expert`

**Naming rule**: Must use `drugbank-expert` NOT `drugbank` — the latter returns 400 `agent_create_failed`.

### Sending Messages (Task Polling)
`sendTextMessage` returns immediately but the task is async. **Always poll until completed:**

```typescript
// Poll every 200ms, timeout at 30s
while (attempts < 150) {
  const task = await getTask(taskId);
  if (task.state === 'completed') break;
  await sleep(200);
  attempts++;
}
// NEVER extract from a pending/running task
```

Task responses use `kind` not `type` for parts. `extractTaskText` checks artifacts first, then `status.message`.

### `contextId` for Conversation Memory
Pass `contextId` to maintain conversation history across turns. Works perfectly — the initial investigation that suggested it was broken was incorrect. The actual problem was `web-search-expert`.

---

## Known Broken: `web-search-expert`

**Never use `web-search-expert` in production.** It:
- Adds 10-15s minimum latency when it works
- Causes complete API hangs (60s+) frequently
- Gets worse with larger conversation history
- Has no error — just hangs indefinitely

Disabled in case reasoning since March 2026. Report filed with Corti support.

---

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/corti/stream` | Audio streaming, returns facts via SSE |
| `POST /api/corti/facts` | Finalize facts for a recording |
| `POST /api/corti/diagnose` | Legacy diagnosis (pre-agent) |
| `POST /api/corti/generate-document` | Trigger doc generation |
| `POST /api/corti/reconcile-facts` | Multi-recording fact reconciliation agent |
| `POST /api/corti/extract-patient` | Extract patient info from transcript |
| `POST /api/corti/extract-billing` | Background billing item extraction |
| `POST /api/corti/generate-invoice` | Invoice document generation |
| `GET /api/corti/auth` | Token endpoint |
