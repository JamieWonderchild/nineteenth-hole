# Case Reasoning Feature - Comprehensive Testing

## Overview
This directory contains comprehensive testing for the case reasoning feature to identify and quantify the root cause of inconsistent behavior (failure rate: 30-60% expected).

## Root Cause Hypothesis
**Asynchronous Task Completion Not Handled**: The API returns immediately after sending a message to Corti, but the task is still in `pending`/`running` state. The extraction logic only works for `completed` tasks, causing "I could not generate a response" fallback messages.

## Directory Structure
```
testing/case-reasoning/
├── test-data/          # Realistic encounter fixtures
├── logs/               # Test execution logs with timestamps
├── results/            # Screenshots, summary, analysis
└── README.md          # This file
```

## Test Scenarios

### 1. Starter Prompt Tests (70 iterations)
All 7 starter prompts × 10 iterations each:
1. "What differential diagnoses should I consider?"
2. "What diagnostic tests do you recommend?"
3. "Review relevant literature for this case"
4. "What treatment options are available?"
5. "Are there any drug interactions I should know about?"
6. "What's the prognosis for this condition?"
7. "What client education points should I cover?"

### 2. Conversation Continuity (15 iterations)
- Follow-up questions (3 sequential messages)
- Mid-chat context switching
- Long conversations (10+ messages)

### 3. Edge Cases (15 iterations)
- No encounter context
- Empty encounter (0 facts)
- Rapid-fire messages
- Long messages (500+ words)
- Special characters

### 4. Timing Analysis (100 iterations)
Measure at each stage:
- Time to `pending` state
- Time to `running` state
- Time to `completed` state
- Total end-to-end latency
- Variance analysis

## Success Criteria

**Per-Test**:
- ✅ **Success**: Coherent AI response, references facts, no errors, < 30s
- ❌ **Failure**: "Could not generate" message, empty response, timeout, error
- ⚠️ **Partial**: Generic response (doesn't reference facts), truncated, slow (>30s)

**Per-Scenario**:
- Calculate success rate for each scenario type
- < 70% = Critical Bug (expected current state)
- > 95% = Acceptable (target after fix)

## Test Execution Method

### Primary: Manual UI Testing
1. Open `/case-reasoning` page in browser
2. Use DevTools (Console + Network tabs)
3. Click starter prompts or type custom messages
4. Record: result, response time, task status, console errors
5. Capture screenshots for failures

### Supplementary: Programmatic Testing
- For high-iteration timing measurements
- Automated CSV logging
- Regression testing after fix

## Expected Findings

**Pre-Fix Baseline**:
- Success rate: 30-60% (inconsistent)
- Primary failure: "Could not generate response"
- Root cause: Task returned in `pending`/`running` state
- Average task completion: ~2-3 seconds
- API returns in: ~150-300ms (too fast!)

**Post-Fix Target**:
- Success rate: >95%
- Only legitimate failures (network, Corti API errors)
- No correlation between complexity and failure

## Test Data

Three encounter fixtures:

1. **encounter-simple.json**: 5-10 facts, basic case
2. **encounter-complex.json**: 20+ facts, multi-system case
3. **encounter-empty.json**: Edge case with minimal data

## Timeline

1. **Setup** (1-2h): Branch, directories, test data, logging
2. **Baseline Testing** (3-4h): 100 core tests with documentation
3. **Timing Analysis** (2-3h): 100 timing tests with DevTools
4. **Analysis & Reporting** (2h): Aggregate, write reports
5. **Post-Fix Validation** (2-3h): Re-run after fix

**Total: 10-14 hours**

## Files Generated

- `logs/test-log-YYYYMMDD-HHMMSS.csv` - Raw test data
- `results/test-summary.md` - Executive summary
- `results/failure-patterns.md` - Analysis of failure modes
- `results/timing-data.csv` - Timing analysis
- `results/screenshots/` - Organized by success/failure

## Next Steps

1. ✅ Create branch and directory structure
2. 🔄 Prepare test data (export encounters from Convex)
3. ⏳ Execute baseline tests (70 starter prompt iterations)
4. ⏳ Timing analysis (100 iterations)
5. ⏳ Analysis and reporting
6. ⏳ Implement fix based on findings
7. ⏳ Post-fix validation
