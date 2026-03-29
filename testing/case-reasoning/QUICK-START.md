# Quick Start - Case Reasoning Testing

## Step 1: Start Dev Server

```bash
cd /Users/jar/Documents/vetai-assistant
npm run dev
```

Wait for: `✓ Ready on http://localhost:3000`

## Step 2: Get a Real Encounter ID

### Option A: Use Convex Dashboard
1. Open https://dashboard.convex.dev
2. Navigate to your [PRODUCT_NAME] project
3. Go to "Data" → "encounters" table
4. Find a encounter with facts (not empty)
5. Copy the `_id` field (e.g., `k123abc456def789`)

### Option B: Create via UI
1. Open http://localhost:3000/patients
2. Create or select a patient
3. Click "New Encounter" or "Record"
4. Record a short voice encounter (30-60 seconds)
5. Speak clearly: "Max is a 3 year old Labrador with vomiting since yesterday"
6. Finalize the recording
7. Copy the encounter ID from the URL

## Step 3: Open Case Reasoning Page

Navigate to:
```
http://localhost:3000/case-reasoning?consultationId=<PASTE_ID_HERE>
```

Example:
```
http://localhost:3000/case-reasoning?consultationId=k123abc456def789
```

## Step 4: Open DevTools

**Chrome/Safari**: Press `Cmd + Option + I`

Open TWO tabs in DevTools:
1. **Console** tab - watch for logs and errors
2. **Network** tab - monitor API requests

In Network tab:
- Enable "Preserve log" checkbox
- Filter by "Fetch/XHR" for cleaner view

## Step 5: Run First Test

1. Click the first starter prompt: **"What differential diagnoses should I consider?"**

2. Watch the UI:
   - ✅ Success: AI response appears with clinical reasoning
   - ❌ Failure: "I could not generate a response..." message

3. Check Network tab:
   - Find: `/api/case-reasoning/chat` POST request
   - Click it → Preview tab
   - Look for `message` field in response
   - Note the response time (Time column)

4. Check Console tab:
   - Look for errors (red text)
   - Look for task status logs

## Step 6: Record Results

Create a CSV file:
```
testing/case-reasoning/logs/test-log-20260318-session1.csv
```

Use this header:
```csv
timestamp,test_number,scenario_type,prompt,consultation_id,result,response_time_ms,task_status,error_message,notes
```

Add a row for your test:
```csv
2026-03-18T10:00:00.000Z,1,starter_prompt_1,"What differential diagnoses should I consider?",k123abc456def789,success,2500,completed,,Response mentioned vomiting differential
```

## Step 7: Continue Testing

Run all 7 starter prompts, 10 times each:

1. What differential diagnoses should I consider?
2. What diagnostic tests do you recommend?
3. Review relevant literature for this case
4. What treatment options are available?
5. Are there any drug interactions I should know about?
6. What's the prognosis for this condition?
7. What client education points should I cover?

**Tips**:
- Refresh page between tests to reset state
- Randomize the order to avoid caching effects
- Take screenshots of interesting failures
- Note any patterns (e.g., "first test always fails")

## Step 8: Analyze Patterns

After 20-30 tests, look for patterns:

**Timing Pattern**:
- Are failures correlated with fast response times (<500ms)?
- Are successes correlated with slower times (>2s)?

**Task Status Pattern**:
- Do failures always have `task.status.state = 'pending'`?
- Do successes always have `task.status.state = 'completed'`?

**Failure Rate**:
- What % of tests fail?
- Is it consistent across prompts?

## Quick Reference: Success vs Failure

### Success Indicators
- ✅ Response appears in chat
- ✅ Response references facts from encounter
- ✅ Response makes clinical sense
- ✅ Network shows `completed` task status
- ✅ No errors in console

### Failure Indicators
- ❌ "I could not generate a response..." message
- ❌ Network shows `pending` or `running` task status
- ❌ Fast API response (<500ms suggests task not completed)
- ❌ Generic response without fact references
- ❌ Console errors (red text)

## Expected Results (Pre-Fix)

Based on code analysis:
- **Failure Rate**: 30-60%
- **Primary Symptom**: "Could not generate response"
- **Root Cause**: API returns before Corti task completes
- **Timing**: Fast API response (~300ms) but task needs ~2-3s

## Need Help?

- Review `TESTING-GUIDE.md` for detailed protocols
- Check `test-data/` for sample encounter structures
- See `results/*-template.md` for reporting formats

## After Testing

1. Fill out `results/test-summary.md`
2. Document patterns in `results/failure-patterns.md`
3. Aggregate timing data in `results/timing-data.csv`
4. Organize screenshots in `results/screenshots/`
