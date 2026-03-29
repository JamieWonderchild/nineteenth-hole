# Case Reasoning Testing Guide

## Setup Instructions

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Prepare Your Browser
- Open Chrome/Safari DevTools (Cmd+Option+I)
- Navigate to Console tab
- Open Network tab in a second DevTools panel
- Enable "Preserve log" in Network tab

### 3. Access the Case Reasoning Page
```
http://localhost:3000/case-reasoning
```

### 4. Load Test Data (Manual Setup Required)

**Option A: Use Existing Encounter**
1. Navigate to `/encounters` page
2. Find a encounter with facts
3. Copy the encounter ID from the URL
4. Use that ID in the case reasoning page URL: `/case-reasoning?consultationId=<ID>`

**Option B: Create New Test Encounter**
1. Navigate to `/patients` page
2. Create or select a patient
3. Record a voice encounter with test data
4. Use the encounter ID from the created encounter

**Note**: The test data JSON files in `test-data/` are for reference only. They show the expected data structure but cannot be directly imported into Convex without a custom script.

## 7 Starter Prompts to Test

Copy these prompts exactly for consistent testing:

### 1. Differential Diagnoses
```
What differential diagnoses should I consider?
```

### 2. Diagnostic Tests
```
What diagnostic tests do you recommend?
```

### 3. Literature Review
```
Review relevant literature for this case
```

### 4. Treatment Options
```
What treatment options are available?
```

### 5. Drug Interactions
```
Are there any drug interactions I should know about?
```

### 6. Prognosis
```
What's the prognosis for this condition?
```

### 7. Client Education
```
What client education points should I cover?
```

## Test Execution Protocol

### For Each Test:

1. **Before Sending Message**:
   - Clear Console (Cmd+K)
   - Note current timestamp
   - Take screenshot of page state (optional)

2. **Send the Message**:
   - Click starter prompt OR paste custom message
   - Start timer (use DevTools Performance recording if measuring timing)

3. **Monitor DevTools Console**:
   - Watch for console.log messages
   - Look for errors (red text)
   - Note task status updates (if logged)

4. **Monitor Network Tab**:
   - Find the `/api/case-reasoning/chat` POST request
   - Note response time (Time column)
   - Click request → Preview tab to see response payload
   - Check if task status is `pending`, `running`, or `completed`

5. **Record the Result**:
   - ✅ **Success**: AI response appears, references facts, makes sense
   - ❌ **Failure**: "Could not generate response" OR timeout OR error
   - ⚠️ **Partial**: Generic response without referencing facts, slow, truncated

6. **Capture Data**:
   - Screenshot of failure (if applicable)
   - Copy console errors (if any)
   - Copy network response payload (if failure)
   - Note approximate response time

7. **Log to CSV**:
   - Open `logs/test-log-YYYYMMDD-HHMMSS.csv`
   - Add row with: timestamp, test number, scenario type, prompt, fixture, result, time, task status, error, notes

## CSV Logging Template

Create a new log file for each testing session:
```
logs/test-log-20260318-100000.csv
```

Columns:
```
timestamp,test_number,scenario_type,prompt,consultation_fixture,result,response_time_ms,task_status,error_message,notes
```

Example rows:
```csv
2026-03-18T10:00:00.000Z,1,starter_prompt_1,"What differential diagnoses should I consider?",consultation_simple,success,2500,completed,,Response referenced vomiting and gastroenteritis
2026-03-18T10:01:30.000Z,2,starter_prompt_1,"What differential diagnoses should I consider?",consultation_simple,failure,350,pending,"Could not generate response",API returned too quickly - task still pending
2026-03-18T10:03:00.000Z,3,starter_prompt_2,"What diagnostic tests do you recommend?",consultation_complex,success,3200,completed,,Referenced PU/PD and recommended T4, chemistry
```

## Testing Scenarios

### Round 1: Starter Prompts (70 tests)
- Each of 7 prompts × 10 iterations
- Use encounter-simple.json for prompts 1, 4, 5, 7
- Use encounter-complex.json for prompts 2, 3, 6
- Randomize order to avoid patterns

### Round 2: Conversation Continuity (15 tests)
- Test 1-5: 3-message conversations (starter + 2 follow-ups)
- Test 6-10: 5-message conversations
- Test 11-15: 10-message conversations
- Measure: Does context persist? Do follow-ups work?

### Round 3: Edge Cases (15 tests)
- Test 1-3: No encounter context (no `?consultationId=` param)
- Test 4-6: Empty encounter (0 facts)
- Test 7-9: Rapid-fire (send 3 messages within 5 seconds)
- Test 10-12: Long messages (500+ words)
- Test 13-15: Special characters (emojis, medical symbols)

### Round 4: Timing Analysis (100 tests)
- Use DevTools Performance recording
- Measure: Time from click → API call → response visible
- Record task status at each checkpoint
- Calculate: min, max, mean, median, p95, p99

## Success Criteria

### Individual Test
- ✅ Success: Coherent response, references facts, < 30s, no errors
- ❌ Failure: "Could not generate", empty, timeout, error
- ⚠️ Partial: Generic (no fact references), slow (>30s), truncated

### Scenario Group
- **Critical Bug**: < 70% success rate
- **Acceptable**: > 95% success rate

## Expected Findings (Pre-Fix)

Based on code analysis, we expect:
- **Success Rate**: 30-60% (highly inconsistent)
- **Primary Failure**: "I could not generate a response..." message
- **Root Cause**: Task status is `pending` or `running` when API returns
- **Timing Pattern**:
  - API response time: ~150-300ms (too fast!)
  - Actual task completion: ~2-3 seconds
  - Gap of ~2-3 seconds where task is still processing

## Debugging Tips

### Check Console for These Messages
```javascript
// Look for Corti task creation
console.log('Created Corti task:', taskId)

// Look for task status updates
console.log('Task status:', task.status.state)

// Look for extraction failures
console.log('Failed to extract text from task')
```

### Check Network Response Payload
```json
{
  "message": "I could not generate a response...",
  "timestamp": "2026-03-18T10:00:00.000Z"
}
```
vs
```json
{
  "message": "Based on the clinical presentation...",
  "timestamp": "2026-03-18T10:00:00.000Z"
}
```

### Common Error Messages
- `"Could not generate a response"` → Task not completed yet
- `"Failed to create agent"` → Corti API error
- `"No encounter found"` → Missing consultationId
- `"Expert creation failed"` → Invalid expert name

## Next Steps After Testing

1. **Analyze Results**:
   - Calculate success rates by scenario
   - Identify timing patterns
   - Document failure modes

2. **Write Reports**:
   - `results/test-summary.md` - Executive summary
   - `results/failure-patterns.md` - Detailed failure analysis
   - `results/timing-data.csv` - Aggregated timing data

3. **Implement Fix**:
   - Primary change: Add polling loop in `/api/case-reasoning/chat`
   - Poll Corti task status every 200ms until `completed`
   - Timeout after 30 seconds

4. **Post-Fix Validation**:
   - Re-run all tests
   - Verify >95% success rate
   - Compare before/after metrics
