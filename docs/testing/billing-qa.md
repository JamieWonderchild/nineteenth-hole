# AI Billing Feature - Manual Testing Checklist

**Before pushing to production, complete ALL sections of this testing checklist.**

Last Updated: March 18, 2026
Feature: Two-Phase AI Billing with Revenue Recovery

---

## 🎯 Testing Overview

This feature extracts billable items from encounter recordings, compares what was **PLANNED** vs what was **DONE**, and flags missed charges to recover lost revenue.

**Critical Components:**
- ✅ Catalog management & tax settings
- ✅ Prospective billing (during encounter)
- ✅ Retrospective billing (post-encounter)
- ✅ Reconciliation algorithm
- ✅ Dashboard analytics

**Estimated Testing Time:** 45-60 minutes for complete workflow

---

## ✅ Pre-Testing Setup

- [ ] Dev environment running (`npm run dev`)
- [ ] Convex dev running (`npx convex dev`)
- [ ] Logged in with test organization
- [ ] Active subscription (billing not blocked)
- [ ] At least one test patient exists
- [ ] Clear console (no existing errors)

---

## 📋 SECTION 1: Catalog Management & Tax Settings

### Test 1.1: Navigate to Billing
1. [ ] Go to `/billing`
2. [ ] Page loads without errors
3. [ ] See two tabs: "Overview" and "Catalog"
4. [ ] BillingGuard doesn't block access

### Test 1.2: Tax Settings Configuration

#### Part A: Tax-Exclusive (Added on Top)
1. [ ] Go to `/settings/billing-preferences`
2. [ ] Enable tax checkbox
3. [ ] Set tax rate: `8.5`
4. [ ] Set tax name: `Sales Tax`
5. [ ] Currency: `USD`
6. [ ] **UNCHECK** "Tax is included in item prices"
7. [ ] Verify "Save Tax Settings" button is **enabled**
8. [ ] Click "Save Tax Settings"
9. [ ] See success toast
10. [ ] Verify button becomes **disabled** (no changes)
11. [ ] Refresh page
12. [ ] Verify settings persist

#### Part B: Tax-Inclusive (VAT Mode)
1. [ ] Change tax rate to `20`
2. [ ] Change name to `VAT`
3. [ ] **CHECK** "Tax is included in item prices"
4. [ ] Button becomes enabled
5. [ ] Save and verify success
6. [ ] Return to `/billing?tab=catalog`
7. [ ] Verify tax banner shows: "✅ VAT 20% (included)"
8. [ ] Hover badge and verify tooltip shows calculation

### Test 1.3: Create Billing Catalog

**Create these 10 items:**

| Code | Name | Category | Price | Taxable | Notes |
|------|------|----------|-------|---------|-------|
| EXAM-001 | Comprehensive Physical Exam | exam | $75.00 | Yes | Basic |
| LAB-001 | CBC Panel | lab | $45.00 | Yes | Common |
| LAB-002 | Urinalysis | lab | $30.00 | Yes | Common |
| PROC-001 | Dental Cleaning - Full | procedure | $180.00 | Yes | High value |
| PROC-002 | Tooth Extraction | procedure | $60.00 | Yes | Per tooth |
| MED-001 | Amoxicillin 10-day supply | medication | $25.00 | Yes | Common Rx |
| MED-002 | Carprofen 500mg | medication | $40.00 | Yes | Pain mgmt |
| SUPPLY-001 | E-collar | supply | $15.00 | Yes | Retail item |
| SUPPLY-002 | Bandage materials | supply | $10.00 | Yes | Consumable |
| PROC-003 | Emergency After-Hours | procedure | $100.00 | No | Non-taxable |

**For each item:**
1. [ ] Click "Add Item" button
2. [ ] Fill all fields correctly
3. [ ] Click "Save"
4. [ ] Item appears in catalog list
5. [ ] Category badge shows correct color

**After all items added:**
- [ ] Total active items: 10
- [ ] Items grouped by category
- [ ] Can switch between category tabs
- [ ] All tab shows all items

### Test 1.4: Edit & Archive
1. [ ] Click "Edit" on "E-collar"
2. [ ] Change price to `$18.00`
3. [ ] Save
4. [ ] Verify price updated
5. [ ] Click "Archive" on "Bandage materials"
6. [ ] Confirm archive dialog
7. [ ] Item removed from active list
8. [ ] Active items now: 9

**✅ Section 1 Complete** - Catalog and tax settings configured

---

## 📋 SECTION 2: Prospective Billing (During Encounter)

### Test 2.1: Create Encounter with Recording

1. [ ] Navigate to test patient detail page
2. [ ] Click "New Encounter"
3. [ ] Start recording
4. [ ] **Speak this script clearly:**

```
"Okay, let's start with Buddy's examination today. I'm going to perform
a comprehensive physical exam. His owner mentioned he's been limping,
so we'll need to run a CBC panel to check for infection. I'm also
planning to do a urinalysis to rule out any kidney issues. Based on
what I'm seeing with his teeth, we should schedule a full dental
cleaning under sedation."
```

5. [ ] Stop recording after ~30 seconds
6. [ ] Wait for processing (spinner)
7. [ ] Recording appears in timeline

### Test 2.2: Verify Prospective Extraction

**Check for "Planned Services" Widget:**
- [ ] Widget appears on page
- [ ] Shows extracted items (may vary, but expect ~3-4 items)

**Expected extractions (approximate):**
- [ ] Comprehensive Physical Exam (~$75)
- [ ] CBC Panel (~$45)
- [ ] Urinalysis (~$30)
- [ ] Dental Cleaning - Full (~$180)

**For each extracted item verify:**
- [ ] Description matches catalog
- [ ] Catalog item matched (shows code)
- [ ] Unit price correct
- [ ] Quantity = 1
- [ ] Can see confidence indicator (if shown)

**Estimated total:**
- [ ] Shows sum of all items (~$330)
- [ ] Updates when items removed

### Test 2.3: Edit Prospective Items
1. [ ] Find any item
2. [ ] Click to edit quantity (if editable)
3. [ ] Verify total recalculates
4. [ ] Remove "Urinalysis" (click X or remove)
5. [ ] Verify item removed
6. [ ] Verify total decreased by $30

### Test 2.4: Save Encounter
1. [ ] Click "Save Encounter" button
2. [ ] Redirects to `/encounter/[id]`
3. [ ] Encounter appears in patient history
4. [ ] No console errors

**✅ Section 2 Complete** - Prospective items extracted

---

## 📋 SECTION 3: Retrospective Billing & Reconciliation

### Test 3.1: Open Encounter Detail
1. [ ] From patient page or dashboard, open saved encounter
2. [ ] ConsultationDetail page loads
3. [ ] See facts/timeline section
4. [ ] See WorkflowPanel (SOAP, etc.)
5. [ ] See BillingReconciliationPanel

### Test 3.2: Add Retrospective Recording

1. [ ] In BillingReconciliationPanel, click "Add Retrospective Dictation"
   - OR use "Add Recording" button
2. [ ] Start new recording
3. [ ] **Speak this retrospective script:**

```
"Encounter completed for Buddy. I performed the comprehensive
physical exam and ran the CBC panel as planned. The urinalysis came
back normal. During the dental cleaning, I discovered two severely
infected teeth that required extraction. I extracted both teeth
successfully. I've prescribed Amoxicillin 10-day supply for infection
prevention and gave the owner an e-collar to prevent licking.
I also administered Carprofen for pain management."
```

4. [ ] Stop recording
5. [ ] Wait for extraction (~10-15 seconds)
6. [ ] Retrospective items appear

### Test 3.3: Trigger Reconciliation

1. [ ] If auto-reconciliation doesn't trigger, click "Reconcile" button
2. [ ] Wait for reconciliation (~2-3 seconds)
3. [ ] Reconciliation summary appears

### Test 3.4: Review Reconciliation Results

**Section: ✅ Matched Services (GREEN)**
- [ ] Section exists and is collapsible
- [ ] Shows 2-3 matched items:
  - [ ] Comprehensive Physical Exam ($75)
  - [ ] CBC Panel ($45)
  - [ ] Dental Cleaning - Full ($180)
- [ ] Items have green checkmarks
- [ ] Can expand/collapse section

**Section: ⚠️ Missed Charges (AMBER/YELLOW)**
- [ ] Section expanded by default
- [ ] **Savings banner visible:** `💰 Recovered $[amount] in almost-missed charges!`
- [ ] Shows missed items (~4 items):
  - [ ] Tooth Extraction × 2 ($60 × 2 = $120)
  - [ ] Amoxicillin 10-day supply ($25)
  - [ ] E-collar ($18)
  - [ ] Carprofen 500mg ($40)
- [ ] **Total missed: ~$203** 💰
- [ ] Each item has "Add to Bill" button

**Section: ⊝ Not Performed (GRAY)**
- [ ] Section exists
- [ ] Shows Urinalysis ($30) as cancelled/not performed
- [ ] Item appears grayed out or with strikethrough

**Verification:**
- [ ] Math is correct (matched + missed = all retrospective items)
- [ ] No console errors
- [ ] Sections are visually distinct (colors)

### Test 3.5: Add Missed Items to Bill

#### Test A: Add Individual Item
1. [ ] Click "Add to Bill" on "Tooth Extraction (×2)"
2. [ ] Item moves from "Missed" to "Matched" section
3. [ ] Savings banner updates: now shows ~$83 remaining
4. [ ] No errors

#### Test B: Add All Missed Items
1. [ ] Click "Add All to Invoice" button (or similar)
2. [ ] All missed items move to matched section
3. [ ] Savings banner changes to: "All missed charges added!" or $0 remaining
4. [ ] Total matched count increases
5. [ ] Missed section now empty or hidden

### Test 3.6: Manual Item Addition
1. [ ] Find "Add Manual Item" button
2. [ ] Click it
3. [ ] Search for "Emergency After-Hours"
4. [ ] Set quantity: 1
5. [ ] Click "Add"
6. [ ] Item appears in matched section
7. [ ] Item shows `manuallyAdded: true` indicator (badge or icon)

**✅ Section 3 Complete** - Reconciliation works, $203 recovered!

---

## 📋 SECTION 4: Dashboard & Analytics

### Test 4.1: Navigate to Billing Overview
1. [ ] Go to `/billing` (Overview tab)
2. [ ] Page loads without errors
3. [ ] Dashboard shows data

### Test 4.2: Verify Stat Cards

**Card 1: Revenue Recovered This Month**
- [ ] Shows dollar amount: `$203.00` (or your test total)
- [ ] Shows trend: `1 encounter` (or your count)
- [ ] Green color theme
- [ ] Icon: TrendingUp

**Card 2: Pending Reconciliations**
- [ ] Shows `0` (if you added all missed items)
- [ ] OR shows count of encounters with unresolved missed items
- [ ] Amber color theme
- [ ] Icon: AlertCircle

**Card 3: Active Catalog Items**
- [ ] Shows `9` (or 10 if you didn't archive bandages)
- [ ] Has "Manage Catalog" link
- [ ] Link navigates to catalog tab
- [ ] Blue color theme
- [ ] Icon: Package

**Card 4: This Month's Encounters**
- [ ] Shows `1` (or your test count)
- [ ] Blue color theme
- [ ] Icon: Stethoscope

### Test 4.3: Verify Revenue Trend Chart
1. [ ] Chart displays below stat cards
2. [ ] X-axis shows dates
3. [ ] Y-axis shows dollar amounts
4. [ ] Data point exists for today showing $203
5. [ ] Hover over data point → tooltip shows:
   - [ ] Date
   - [ ] Amount formatted as currency
6. [ ] Chart renders without errors
7. [ ] Responsive (resize window to check)

### Test 4.4: Pending Reconciliations Table

**If you have pending reconciliations:**
1. [ ] Table appears below chart
2. [ ] Shows columns:
   - [ ] Patient (name + species)
   - [ ] Date
   - [ ] Missed Items (count badge)
   - [ ] Amount (in green)
   - [ ] Action ("Review" button)
3. [ ] Click "Review" button
4. [ ] Navigates to encounter detail page

**If no pending reconciliations:**
- [ ] Table doesn't show or shows "No pending reconciliations"

**✅ Section 4 Complete** - Dashboard displays correctly

---

## 📋 SECTION 5: Tax Calculations (Critical!)

### Test 5.1: Tax-Exclusive Mode (US Sales Tax)

**Setup:**
1. [ ] Go to `/settings/billing-preferences`
2. [ ] Enable tax
3. [ ] Rate: `10`
4. [ ] Name: `Sales Tax`
5. [ ] **UNCHECK** "Tax is included"
6. [ ] Save

**Create test encounter:**
- [ ] Add prospective items:
  - CBC Panel ($45)
  - Exam ($75)
- [ ] Add retrospective (same items)
- [ ] Reconcile
- [ ] Check reconciliation panel or wherever totals show

**Expected Math:**
```
Subtotal: $120.00
Tax (10%): $12.00
Total: $132.00
```

**Verify:**
- [ ] Subtotal = $120.00
- [ ] Tax = $12.00
- [ ] Total = $132.00
- [ ] Tax shown as separate line item

### Test 5.2: Tax-Inclusive Mode (UK VAT)

**Setup:**
1. [ ] Go to billing preferences
2. [ ] Change rate to `20`
3. [ ] Change name to `VAT`
4. [ ] **CHECK** "Tax is included"
5. [ ] Save

**Same encounter:**
- [ ] Refresh or recalculate

**Expected Math:**
```
Total: $120.00 (includes tax)
Price without tax: $100.00
Tax (20%): $20.00
```

**Verify:**
- [ ] Total = $120.00 (NOT $144!)
- [ ] Tax breakdown shown for info: $20.00
- [ ] Price without tax shown: $100.00
- [ ] Customer pays $120.00 total (not increased)

### Test 5.3: Mixed Taxable/Non-Taxable

**Setup:**
1. [ ] Tax-exclusive mode (10%)
2. [ ] Create encounter with:
   - [ ] Exam ($75, taxable: true)
   - [ ] Emergency Fee ($100, taxable: false)

**Expected Math:**
```
Exam: $75.00 (taxable)
Emergency: $100.00 (non-taxable)
Subtotal: $175.00
Tax (10% of $75): $7.50
Total: $182.50
```

**Verify:**
- [ ] Tax only applied to exam ($7.50)
- [ ] Emergency fee NOT taxed
- [ ] Total = $182.50

**✅ Section 5 Complete** - Tax calculations correct

---

## 📋 SECTION 6: Edge Cases & Error Handling

### Test 6.1: Fuzzy Matching
1. [ ] Create encounter
2. [ ] Prospective: "I'm going to do a complete blood count test"
3. [ ] Retrospective: "I completed the CBC panel"
4. [ ] Reconcile
5. [ ] **Verify:** Items fuzzy match (shown as matched, not missed)
6. [ ] **Verify:** Match type indicator shows "fuzzy" (if displayed)

### Test 6.2: Encounter with No Retrospective
1. [ ] Create encounter with prospective items only
2. [ ] Save
3. [ ] Open detail page
4. [ ] **Verify:** Shows only prospective items
5. [ ] **Verify:** "Add Retrospective Dictation" button available
6. [ ] **Verify:** No errors or broken UI

### Test 6.3: Manual-Only Encounter
1. [ ] Create encounter without recording
2. [ ] Go to detail page
3. [ ] Use "Add Manual Item" to add 3 items
4. [ ] **Verify:** Items marked as `phase: prospective`
5. [ ] **Verify:** Items show manual indicator
6. [ ] **Verify:** Can still add retrospective later

### Test 6.4: Empty Reconciliation
1. [ ] Create encounter with no billing items
2. [ ] Try to reconcile
3. [ ] **Verify:** Shows "No billing items to reconcile" message
4. [ ] **Verify:** Doesn't crash or show errors

### Test 6.5: Permission Check
1. [ ] Log in as user without `canManageTeam` permission (if possible)
2. [ ] Go to `/billing?tab=catalog`
3. [ ] **Verify:** "Add Item" button hidden or disabled
4. [ ] **Verify:** Edit/Archive buttons hidden on items
5. [ ] **Verify:** "Configure" link in tax banner hidden or disabled
6. [ ] **Verify:** Can still view catalog items

### Test 6.6: Subscription Block
1. [ ] Simulate expired subscription (if possible)
2. [ ] Try to access `/billing`
3. [ ] **Verify:** BillingGuard blocks access
4. [ ] **Verify:** Shows upgrade prompt
5. [ ] **Verify:** Redirects or shows paywall

**✅ Section 6 Complete** - Edge cases handled

---

## 📋 SECTION 7: End-to-End Happy Path (15 min)

**Complete workflow start to finish:**

1. [ ] **Setup:** Catalog has 9+ items, tax configured
2. [ ] **Create:** New encounter with recording
3. [ ] **Prospective:** 4 items extracted ("planning to...")
4. [ ] **Save:** Encounter saved successfully
5. [ ] **Retrospective:** Add recording ("I completed...")
6. [ ] **Extract:** 6 items extracted (4 matched + 2 new)
7. [ ] **Reconcile:** Auto-triggers
8. [ ] **Review:** See matched (4), missed (2), not performed (0)
9. [ ] **Savings:** Banner shows $X recovered
10. [ ] **Add:** Click "Add All to Invoice"
11. [ ] **Dashboard:** Navigate to `/billing` overview
12. [ ] **Verify:** Dashboard shows updated metrics:
    - [ ] Revenue recovered
    - [ ] Chart has data point
    - [ ] Stat cards populated
13. [ ] **Complete:** No console errors throughout

**✅ Section 7 Complete** - Full workflow successful!

---

## 📋 SECTION 8: UI/UX Quality Checks

### Visual & Interaction
- [ ] No layout shifts or jumps
- [ ] Loading states show spinners
- [ ] Buttons disable during saves
- [ ] Success toasts appear and dismiss
- [ ] Error messages are clear and helpful
- [ ] Colors are consistent (green=good, amber=warning, red=error)
- [ ] Icons are appropriate
- [ ] Text is readable (contrast, size)

### Responsiveness
- [ ] Test on narrow window (~400px mobile)
- [ ] Test on tablet width (~768px)
- [ ] Test on desktop (~1920px)
- [ ] Tables scroll horizontally on mobile
- [ ] Buttons don't overflow
- [ ] Cards stack properly

### Accessibility
- [ ] Can tab through forms
- [ ] Buttons have focus states
- [ ] Labels are clear
- [ ] Tooltips work on hover
- [ ] Screen reader friendly (if testable)

### Performance
- [ ] Pages load in <2 seconds
- [ ] No infinite loops in console
- [ ] No memory leaks (check dev tools)
- [ ] Reconciliation completes in <5 seconds
- [ ] Dashboard chart renders quickly

**✅ Section 8 Complete** - UI is polished

---

## 📋 SECTION 9: Browser & Device Testing

### Desktop Browsers
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, macOS)

### Mobile Browsers (if applicable)
- [ ] Safari iOS
- [ ] Chrome Android

### Test on Each:
1. [ ] Navigate to `/billing`
2. [ ] Create catalog item
3. [ ] View dashboard
4. [ ] Verify no browser-specific bugs

**✅ Section 9 Complete** - Cross-browser compatible

---

## 🎉 FINAL CHECKLIST

Before pushing to production, verify:

### Functionality
- [ ] All 9 test sections passed
- [ ] No critical bugs found
- [ ] Tax calculations mathematically correct
- [ ] Reconciliation algorithm accurate (< 5% false positives)
- [ ] Dashboard data matches reality

### Code Quality
- [ ] No console errors in normal operation
- [ ] No TypeScript errors
- [ ] All commits pushed to dev branch
- [ ] Code reviewed (if applicable)

### Documentation
- [ ] This testing doc completed
- [ ] Architecture doc up to date (`docs/BILLING_ARCHITECTURE.md`)
- [ ] Tax calculation docs in `convex/lib/taxCalculations.ts`

### Production Readiness
- [ ] Feature flags configured (if applicable)
- [ ] Error tracking enabled (Sentry, etc.)
- [ ] Convex functions deployed
- [ ] Environment variables set

---

## 🐛 Bug Tracking Template

If you find bugs during testing, document them here:

```markdown
### Bug #1: [Brief Description]
**Severity:** Critical / High / Medium / Low
**Component:** Catalog / Prospective / Retrospective / Dashboard / Tax
**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected:** ...
**Actual:** ...
**Screenshots:** [attach if applicable]
**Console Errors:** [paste if applicable]
```

---

## 📊 Test Results Summary

**Date Tested:** _________________
**Tested By:** _________________
**Environment:** Dev / Staging / Prod

**Results:**
- Sections Passed: _____ / 9
- Bugs Found: _____
- Critical Issues: _____
- Ready for Production: ☐ Yes  ☐ No

**Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

---

## ✅ Sign-Off

I certify that I have completed this testing checklist and the AI Billing feature is ready for production deployment.

**Signature:** _________________
**Date:** _________________

---

**Good luck with testing! 🚀**

If you encounter any issues, refer to:
- Architecture doc: `docs/BILLING_ARCHITECTURE.md`
- Tax calculation code: `convex/lib/taxCalculations.ts`
- Schema definitions: `convex/schema.ts`
