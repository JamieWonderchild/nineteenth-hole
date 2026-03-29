# Case Reasoning Testing - Execution Checklist

Use this checklist to track progress through all 200 tests.

## Pre-Testing Setup ✓

- [x] Create test branch: `test/case-reasoning-async-investigation`
- [x] Create directory structure
- [x] Prepare test data fixtures (3 files)
- [x] Create testing documentation
- [x] Review testing guide and quick start
- [ ] Start dev server (`npm run dev`)
- [ ] Open browser with DevTools
- [ ] Get valid encounter ID from Convex
- [ ] Create CSV log file for session

---

## Round 1: Starter Prompts (70 tests)

### Prompt 1: "What differential diagnoses should I consider?"
- [ ] Test 1 (Simple encounter)
- [ ] Test 2 (Simple encounter)
- [ ] Test 3 (Simple encounter)
- [ ] Test 4 (Simple encounter)
- [ ] Test 5 (Simple encounter)
- [ ] Test 6 (Complex encounter)
- [ ] Test 7 (Complex encounter)
- [ ] Test 8 (Complex encounter)
- [ ] Test 9 (Complex encounter)
- [ ] Test 10 (Complex encounter)

**Success Rate**: ___% (___/10)

### Prompt 2: "What diagnostic tests do you recommend?"
- [ ] Test 11-20 (same pattern as above)

**Success Rate**: ___% (___/10)

### Prompt 3: "Review relevant literature for this case"
- [ ] Test 21-30

**Success Rate**: ___% (___/10)

### Prompt 4: "What treatment options are available?"
- [ ] Test 31-40

**Success Rate**: ___% (___/10)

### Prompt 5: "Are there any drug interactions I should know about?"
- [ ] Test 41-50

**Success Rate**: ___% (___/10)

### Prompt 6: "What's the prognosis for this condition?"
- [ ] Test 51-60

**Success Rate**: ___% (___/10)

### Prompt 7: "What client education points should I cover?"
- [ ] Test 61-70

**Success Rate**: ___% (___/10)

**Round 1 Overall**: ___% (___/70)

---

## Round 2: Conversation Continuity (15 tests)

### 3-Message Conversations (5 tests)
- [ ] Test 71: Starter + follow-up 1 + follow-up 2
- [ ] Test 72: Same pattern
- [ ] Test 73: Same pattern
- [ ] Test 74: Same pattern
- [ ] Test 75: Same pattern

**Success Rate**: ___% (___/5)

### 5-Message Conversations (5 tests)
- [ ] Test 76-80

**Success Rate**: ___% (___/5)

### 10-Message Conversations (5 tests)
- [ ] Test 81-85

**Success Rate**: ___% (___/5)

**Round 2 Overall**: ___% (___/15)

---

## Round 3: Edge Cases (15 tests)

### No Encounter Context (3 tests)
- [ ] Test 86: Remove `?consultationId=` param
- [ ] Test 87: Same
- [ ] Test 88: Same

**Success Rate**: ___% (___/3)
**Expected**: Should fail gracefully or work with generic response

### Empty Encounter (3 tests)
- [ ] Test 89: Use encounter with 0 facts
- [ ] Test 90: Same
- [ ] Test 91: Same

**Success Rate**: ___% (___/3)
**Expected**: Should fail gracefully or ask for more context

### Rapid-Fire Messages (3 tests)
- [ ] Test 92: Send 3 messages within 5 seconds
- [ ] Test 93: Same
- [ ] Test 94: Same

**Success Rate**: ___% (___/3)
**Expected**: May fail due to race conditions

### Long Messages (3 tests)
- [ ] Test 95: Send 500+ word message
- [ ] Test 96: Same
- [ ] Test 97: Same

**Success Rate**: ___% (___/3)

### Special Characters (3 tests)
- [ ] Test 98: Message with emojis, medical symbols
- [ ] Test 99: Same
- [ ] Test 100: Same

**Success Rate**: ___% (___/3)

**Round 3 Overall**: ___% (___/15)

---

## Round 4: Timing Analysis (100 tests)

### Batch 1: First 25 Tests
- [ ] Tests 101-125
- Min: ___ ms, Max: ___ ms, Mean: ___ ms, Median: ___ ms
- Task status distribution: Pending ___%, Running ___%, Completed ___%, Failed ___%

### Batch 2: Tests 26-50
- [ ] Tests 126-150
- Min: ___ ms, Max: ___ ms, Mean: ___ ms, Median: ___ ms
- Task status distribution: Pending ___%, Running ___%, Completed ___%, Failed ___%

### Batch 3: Tests 51-75
- [ ] Tests 151-175
- Min: ___ ms, Max: ___ ms, Mean: ___ ms, Median: ___ ms
- Task status distribution: Pending ___%, Running ___%, Completed ___%, Failed ___%

### Batch 4: Tests 76-100
- [ ] Tests 176-200
- Min: ___ ms, Max: ___ ms, Mean: ___ ms, Median: ___ ms
- Task status distribution: Pending ___%, Running ___%, Completed ___%, Failed ___%

**Round 4 Overall**:
- Total tests: ___/100
- Min: ___ ms, Max: ___ ms, Mean: ___ ms, Median: ___ ms, P95: ___ ms, P99: ___ ms
- Task status: Pending ___%, Running ___%, Completed ___%, Failed ___%

---

## Post-Testing Tasks

- [ ] Aggregate all CSV data
- [ ] Calculate overall success rate
- [ ] Identify failure patterns
- [ ] Create screenshots folder with organized examples
- [ ] Fill out `test-summary.md` (copy from template)
- [ ] Fill out `failure-patterns.md` (copy from template)
- [ ] Write analysis and recommendations
- [ ] Review findings with stakeholders

---

## Overall Summary

**Total Tests Completed**: ___/200
**Overall Success Rate**: ___%
**Primary Failure Mode**: ___________________
**Average Response Time**: ___ ms
**Recommended Fix**: ___________________

---

## Notes & Observations

### Patterns Observed
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Unexpected Findings
1. _______________________________________________
2. _______________________________________________

### Screenshots Captured
- [ ] Success examples (at least 3)
- [ ] Failure examples (at least 5)
- [ ] Network payload examples (pending vs completed)
- [ ] Console output examples
- [ ] Timing comparison screenshots

### Testing Challenges
1. _______________________________________________
2. _______________________________________________

---

## Ready for Implementation?

- [ ] Root cause confirmed
- [ ] Success rate quantified
- [ ] Timing patterns documented
- [ ] Fix approach validated
- [ ] Test data ready for post-fix validation

**Proceed to implementation**: YES / NO
