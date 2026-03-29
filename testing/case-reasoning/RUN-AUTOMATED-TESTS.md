# Running Automated Case Reasoning Tests

This guide explains how to run the automated test suite that programmatically tests the case reasoning API endpoint.

## Prerequisites

1. **Dev server must be running**:
   ```bash
   npm run dev
   ```
   Wait for: `✓ Ready on http://localhost:3000`

2. **Get a valid encounter ID**:

   **Option A: Use Convex Dashboard**
   - Open https://dashboard.convex.dev
   - Navigate to [PRODUCT_NAME] project → Data → encounters table
   - Find a encounter with facts (not empty)
   - Copy the `_id` field (e.g., `k123abc456def789`)

   **Option B: Create via UI**
   - Open http://localhost:3000/patients
   - Create/select a patient
   - Record a voice encounter (30-60 seconds)
   - Copy the encounter ID from the URL

## Running the Tests

### Method 1: Using npm script (recommended)
```bash
npm run test:case-reasoning <CONSULTATION_ID>
```

Example:
```bash
npm run test:case-reasoning k123abc456def789
```

### Method 2: Using environment variable
```bash
TEST_CONSULTATION_ID=k123abc456def789 npm run test:case-reasoning
```

### Method 3: Direct node execution
```bash
cd testing/case-reasoning
node run-tests.mjs <CONSULTATION_ID>
```

## What the Tests Do

### Round 1: Starter Prompt Tests (70 tests)
- Tests all 7 starter prompts × 10 iterations each
- Prompts tested:
  1. "What differential diagnoses should I consider?"
  2. "What diagnostic tests do you recommend?"
  3. "Review relevant literature for this case"
  4. "What treatment options are available?"
  5. "Are there any drug interactions I should know about?"
  6. "What's the prognosis for this condition?"
  7. "What client education points should I cover?"

### Round 2: Timing Analysis (100 tests)
- Runs 100 additional tests cycling through all prompts
- Measures API response times and task status
- Identifies patterns in success/failure rates

**Total: 170 tests**

## Test Metrics

Each test measures:
- ✅ **Success**: Response is coherent, references clinical content, no errors
- ❌ **Failure**: "Could not generate response" message OR empty response
- ⚠️ **Partial**: Response lacks clinical content
- 🔴 **Error**: Request failed with exception

Timing metrics:
- API response time (ms)
- Task status on return (`pending`, `running`, `completed`)
- Min/max/avg/median response times

## Expected Results (Pre-Fix)

Based on code analysis, we expect:
- **Success Rate**: 30-60% (inconsistent)
- **Primary Failure**: "I could not generate a response..."
- **Root Cause**: Task status is `pending` or `running` when API returns
- **Timing Pattern**:
  - Fast API responses (~200-400ms) → Usually fail
  - Slow API responses (>2s) → Usually succeed
  - **Gap**: ~2-3 seconds where task is still processing

## Output Files

After running tests, you'll find:

### Logs Directory (`testing/case-reasoning/logs/`)
- `test-results-<timestamp>.csv` - All test results with detailed data
- `timing-data-<timestamp>.csv` - Timing analysis with task status

### Results Directory (`testing/case-reasoning/results/`)
- `test-summary-<timestamp>.txt` - Executive summary with statistics

## Interpreting Results

### Console Output
During testing, you'll see real-time output:
```
[Test 1] starter_prompt_1: "What differential diagnoses should I..."
  ✓ Result: SUCCESS (2500ms, task: completed)
  Response: Based on the clinical presentation...

[Test 2] starter_prompt_1: "What differential diagnoses should I..."
  ✗ Result: FAILURE (350ms, task: pending)
  Response: I could not generate a response...
```

### Success Indicators
- ✓ Result: SUCCESS
- Response time: >2000ms (task had time to complete)
- Task status: `completed`
- Response preview shows clinical reasoning

### Failure Indicators
- ✗ Result: FAILURE
- Response time: <500ms (API returned too quickly)
- Task status: `pending` or `running`
- Response: "I could not generate a response..."

### Final Summary
```
========================================
TEST SUMMARY
========================================

Total Tests: 170
Success: 68 (40.0%)
Failure: 92 (54.1%)
Partial: 10 (5.9%)
Error: 0 (0.0%)

Response Times:
  Min: 250ms
  Max: 3500ms
  Avg: 1200ms
  Median: 800ms

Task Status Distribution:
  pending: 85 (50.0%)
  running: 15 (8.8%)
  completed: 70 (41.2%)
```

## Analyzing Results

### Key Questions to Answer

1. **What's the exact failure rate?**
   - Look at "Failure" percentage in summary
   - Expected: 40-60%

2. **Is there a correlation between response time and success?**
   - Compare avg response time for successful vs failed tests
   - Expected: Fast responses (<500ms) → failures

3. **What task statuses appear most often for failures?**
   - Look at task status distribution for failed tests
   - Expected: `pending` or `running` for failures

4. **Is the failure rate consistent across prompts?**
   - Check per-prompt success rates in console output
   - Expected: Similar failure rate across all prompts

### CSV Analysis

Open `test-results-<timestamp>.csv` in Excel/Numbers/Google Sheets:

**Pivot Table 1**: Success rate by task status
- Rows: `task_status`
- Columns: `result`
- Values: Count

**Pivot Table 2**: Average response time by result
- Rows: `result`
- Values: Average of `response_time_ms`

**Correlation Analysis**:
- Plot: `response_time_ms` (x-axis) vs `result` (y-axis)
- Expected: Fast times → failures, slow times → success

## Troubleshooting

### Error: "No encounter ID provided"
- Make sure you pass the encounter ID as an argument
- Check that the ID is valid (exists in Convex)

### Error: "fetch failed" or connection refused
- Make sure dev server is running (`npm run dev`)
- Check that port 3000 is available
- Verify API endpoint URL

### All tests failing with errors
- Check Convex deployment is active
- Verify Corti API credentials are set
- Check console for authentication errors

### Tests running very slowly
- This is normal - 170 tests with 300-500ms delays take ~10-15 minutes
- You can reduce test count by editing `run-tests.mjs`:
  - Change iterations in `runStarterPromptTests()` (line ~149)
  - Reduce count in `runTimingTests(100)` (line ~163)

## Next Steps After Testing

1. **Review Summary**: Check overall success rate and task status distribution

2. **Analyze CSVs**: Look for patterns in timing and task status

3. **Document Findings**: Update `results/test-summary.md` and `results/failure-patterns.md`

4. **Implement Fix**: Based on confirmed root cause, add polling loop to API route

5. **Re-test**: Run tests again after implementing fix to verify >95% success rate

## Quick Test (Subset)

To run a quick test with fewer iterations, edit `run-tests.mjs`:

**Line 149**: Change `for (let iteration = 0; iteration < 10; iteration++)` to `< 2`

**Line 163**: Change `await tester.runTimingTests(100);` to `runTimingTests(10);`

This reduces total tests from 170 to 24 (7 prompts × 2 iterations + 10 timing tests).

## Help & Support

- Review `TESTING-GUIDE.md` for detailed testing protocols
- Check `test-data/` for sample encounter structures
- See `results/*-template.md` for reporting format examples
