# Case Reasoning - Failure Pattern Analysis

**Test Date**: YYYY-MM-DD
**Branch**: test/case-reasoning-async-investigation

---

## Failure Pattern #1: Asynchronous Task Completion Not Handled

### Frequency
- **Tests Affected**: X / Y (X%)
- **Scenarios**: All starter prompts, conversation continuity, edge cases
- **Severity**: CRITICAL

### Symptoms
1. User receives message: "I could not generate a response. Please try again."
2. Network tab shows fast API response (~150-300ms)
3. Task status in response payload: `pending` or `running` (not `completed`)
4. No console errors
5. Sometimes works, sometimes doesn't (non-deterministic)

### Root Cause Analysis

**Code Path**:
```
1. User sends message
2. Frontend: POST /api/case-reasoning/chat
3. Backend: chatWithVet() calls client.sendTextMessage()
4. Corti returns task IMMEDIATELY (asynchronous operation)
5. Backend: extractTaskText() checks task.status.state
6. If state !== 'completed', returns null
7. Backend: Uses fallback message "I could not generate a response"
8. Frontend: Displays fallback message to user
```

**Problem**: The code treats an asynchronous operation as synchronous.

**Files Involved**:
- `/src/app/api/case-reasoning/chat/route.ts` (line X)
- `/src/services/case-reasoning-chat.ts` (line 238)
- `/src/lib/corti.ts` (extractTaskText function, lines 435-460)

### Evidence

**Network Response Example (Failure)**:
```json
{
  "message": "I could not generate a response. Please try again.",
  "timestamp": "2026-03-18T10:00:00.000Z"
}
```

**Task Object Structure**:
```json
{
  "id": "task_abc123",
  "status": {
    "state": "pending",  // ← NOT 'completed'
    "message": null
  },
  "parts": [],
  "artifacts": []
}
```

**Timing Evidence**:
- API response time: ~250ms (average)
- Actual task completion: ~2-3 seconds (estimated)
- **Gap: ~2.5 seconds where task is still processing**

### Reproduction Steps
1. Open `/case-reasoning?consultationId=<valid_id>`
2. Click any starter prompt
3. Observe: ~40-60% chance of "Could not generate response" message
4. Check Network tab: task status shows `pending`

### Screenshots
- `screenshots/failure-pattern-1/example-001.png`
- `screenshots/failure-pattern-1/network-payload-001.png`
- `screenshots/failure-pattern-1/console-output-001.png`

### Fix Recommendation

**Primary Fix**: Add polling loop in API route

```typescript
// In /src/app/api/case-reasoning/chat/route.ts

// After sending message to Corti
let task = await chatWithVet(...);

// Poll until completed
const maxAttempts = 150; // 30 seconds with 200ms interval
const pollInterval = 200; // ms

for (let i = 0; i < maxAttempts; i++) {
  if (task.status.state === 'completed') {
    break;
  }

  if (task.status.state === 'failed') {
    throw new Error('Task failed');
  }

  // Wait and retry
  await new Promise(resolve => setTimeout(resolve, pollInterval));

  // Fetch updated task status
  task = await cortiClient.getTask(task.id);
}

// Now extract text from completed task
const responseText = extractTaskText(task);
```

**Supporting Changes**:
1. Add `getTask(taskId)` method to CortiClient if not exists
2. Improve error handling for timeout scenarios
3. Add client-side timeout (30s) in VetChat.tsx
4. Add "Still thinking..." UI after 5 seconds

---

## Failure Pattern #2: Weak Text Extraction with Poor Fallbacks

### Frequency
- **Tests Affected**: X / Y (X%)
- **Scenarios**: Rare, but causes cascading failures
- **Severity**: MEDIUM

### Symptoms
1. Task completes successfully
2. But extractTaskText() still returns null
3. Fallback message shown even though response exists

### Root Cause Analysis

**Problem**: Two extraction methods with different behaviors

1. **extractTaskText()** (primary): Too strict
   - Only checks `task.status.state === 'completed'`
   - Returns null for any other state
   - Doesn't check artifacts or history

2. **extractTextFromTask()** (fallback): Better but inconsistent
   - Checks artifacts first
   - Falls back to status.message
   - But only called after primary fails

**Files Involved**:
- `/src/lib/corti.ts` (lines 435-460)

### Evidence
[Add specific examples if found during testing]

### Fix Recommendation
Consolidate extraction logic into single robust method:
```typescript
function extractTaskText(task: CortiTask): string | null {
  // 1. Check artifacts first
  if (task.artifacts?.length > 0) {
    return task.artifacts[0].content;
  }

  // 2. Check task parts
  if (task.parts?.length > 0) {
    const textPart = task.parts.find(p => p.kind === 'text');
    if (textPart) return textPart.content;
  }

  // 3. Check status message
  if (task.status?.message) {
    return task.status.message;
  }

  // 4. Check task history
  if (task.history?.length > 0) {
    // Get last message from history
  }

  return null;
}
```

---

## Failure Pattern #3: No Error Handling for Agent Creation Retry

### Frequency
- **Tests Affected**: X / Y (X%)
- **Scenarios**: When initial agent creation fails
- **Severity**: HIGH

### Symptoms
1. Uncaught exception crashes the request
2. 500 Internal Server Error
3. No graceful fallback

### Root Cause Analysis

**Code Location**: `/src/services/case-reasoning-chat.ts` (lines 205-212)

**Problem**: Fallback retry has no try/catch

```typescript
// Current code (problematic)
try {
  agent = await createAgent(...);
} catch (error) {
  // Retry without experts - NO TRY/CATCH HERE
  agent = await createAgent(...); // ← Can throw, crashes request
}
```

### Evidence
[Add specific error traces if found during testing]

### Fix Recommendation
```typescript
try {
  agent = await createAgent(...);
} catch (error) {
  console.error('Failed to create agent with experts:', error);

  try {
    // Retry without experts
    agent = await createAgent(...);
  } catch (retryError) {
    console.error('Failed to create agent without experts:', retryError);
    throw new Error('Unable to create reasoning agent');
  }
}
```

---

## Failure Pattern #4: Missing Response Validation

### Frequency
- **Tests Affected**: X / Y (X%)
- **Scenarios**: Network errors, Corti API errors
- **Severity**: MEDIUM

### Symptoms
1. Frontend shows generic error
2. No specific error message from backend
3. No retry logic

### Root Cause Analysis

**Problem**: `/src/components/case-reasoning/VetChat.tsx` (lines 260-277)
- Always tries to parse JSON before checking `response.ok`
- No timeout handling on frontend fetch
- No retry logic for transient failures

### Fix Recommendation
```typescript
// Add timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch('/api/case-reasoning/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  const data = await response.json();
  // ... handle success
} catch (error) {
  if (error.name === 'AbortError') {
    // Handle timeout
  } else {
    // Handle other errors
  }
}
```

---

## Failure Pattern Summary Table

| Pattern | Frequency | Severity | Fix Priority |
|---------|-----------|----------|--------------|
| #1: Async Task Completion | X% | CRITICAL | 1 (Must fix) |
| #2: Weak Text Extraction | X% | MEDIUM | 2 (Should fix) |
| #3: Agent Creation Retry | X% | HIGH | 2 (Should fix) |
| #4: Response Validation | X% | MEDIUM | 3 (Nice to have) |

---

## Test Data References

- **Raw logs**: `logs/test-log-YYYYMMDD-HHMMSS.csv`
- **Screenshots**: `results/screenshots/failure-pattern-*/`
- **Network traces**: `results/network-traces/`
