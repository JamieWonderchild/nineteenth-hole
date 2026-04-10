# Nineteenth Hole — Product Roadmap
### From working prototype to full IG replacement
*April 2026*

---

## Where We Are Today

The platform is built and working. A real club is using it. The foundation is modern, real-time, and well-structured. What we have:

| Feature | Status |
|---|---|
| Member management (join, approve, roles) | ✅ Live |
| Competition creation and leaderboards | ✅ Live |
| Tee time booking | ✅ Live |
| Tour pools / sweepstakes | ✅ Live |
| Quick games (5 formats, stake tracking) | ✅ Live |
| Course card management | ✅ Live |
| Season series / points leagues | ✅ Live |
| Stripe payments (entry fees) | ✅ Live |
| Member directory | ✅ Live |
| In-app messaging (DMs + groups) | ✅ Live |
| Billing / club subscriptions | ✅ Live |

No competitor has this combination. The pools and games features are completely unique. The messaging and directory are better than IG's equivalent. The UX is a generation ahead.

---

## The Gap — What IG Has That We Don't

Honest assessment of what a club currently using IG would miss if they switched today:

### Critical gaps (must close to win clubs)

| Gap | Why It Matters | Complexity |
|---|---|---|
| **WHS handicap integration** | Clubs legally need this to run qualifying competitions | Medium — gated on England Golf ISV licence |
| **Bulk member communications** | Club secretaries email members weekly | Low |
| **Competition formats** | Knockout draws, match play, medal, visitor comps | Medium |
| **Visitor management** | Guest tee times, handicap verification, visitor records | Medium |
| **Live clubhouse leaderboard** | TV display during competitions — clubs love this | Low |
| **Club results / history page** | Public-facing results archive | Low |

### Secondary gaps (important but not day-one blockers)

| Gap | Why It Matters | Complexity |
|---|---|---|
| **Society / group bookings** | Visiting societies are a revenue stream for clubs | Medium |
| **Event management** | Club dinners, AGMs, room bookings | Medium |
| **Accounting export** | Xero integration for club treasurers | Low |
| **Push notifications** | Competition results, tee time reminders | Low |
| **Score entry kiosk** | Touchscreen in clubhouse for score posting | Medium |

### Skip for now (complex, low switching value)

| Gap | Why We're Skipping |
|---|---|
| EPOS / bar till system | Clubs already have hardware; huge integration complexity; not a reason to switch |
| Website CMS | Clubs can keep their existing website; we provide embeddable widgets |
| Access control (door entry) | Specialist hardware; niche requirement |
| Accounting integrations (Sage) | Edge case; Xero export covers most clubs |

The honest truth: **if we close the critical gaps, we can replace IG for the vast majority of UK golf clubs.** Everything else is a phase 2 or 3 conversation.

---

## Phase 1 — Compete (Months 1–3)
*Goal: a club could switch from IG to us today and not miss anything essential*

### 1. WHS Handicap Integration
Apply for England Golf ISV licence immediately. The API (DotGolf) is documented and the integration is well-understood — every major competitor has done it. While the licence is being approved, build the integration against the sandbox.

**Delivers:** Qualifying competition scores automatically posted to CDH. Handicap Index displayed in app. Visitor handicap lookup at point of entry.

### 2. Bulk Member Communications
Simple but high-impact. Club secretaries send weekly emails: results, upcoming competitions, notices. Currently they do this outside IG or with IG's clunky newsletter tool.

**Build:**
- Compose email to all members (or filtered subset: section, membership type, handicap band)
- Schedule sends
- Open/click tracking
- Pre-built templates (competition reminder, results announcement, general notice)

**Delivers:** Replace IG's comms module with something that actually works.

### 3. Competition Format Expansion
Currently we support stroke play, stableford, better ball. Need to add:
- Medal / stroke play qualifying (with WHS score submission)
- Knockout / match play (automated draws, bracket management, in-app messaging to opponents)
- Greensomes, foursomes
- Open competitions (non-members can enter with CDH ID)
- Visitor days

**Delivers:** Clubs can run their full annual competition calendar through the app.

### 4. Live Clubhouse Leaderboard
A dedicated URL (e.g. `club.nineteenth.golf/leaderboard/live`) that displays a real-time competition leaderboard — designed to be shown on a clubhouse TV. No login required, auto-refreshes, full-screen mode.

**Delivers:** Clubs love this. It's a visible, impressive feature that shows during competitions and creates word-of-mouth.

### 5. Visitor Management
- Guest tee time booking (non-members can book, captured in the system)
- Handicap verification via CDH lookup before round
- Visitor round history and follow-up email (with optional return discount)
- Green fee tracking

**Delivers:** Clubs can manage member and visitor tee sheets in one place.

---

## Phase 2 — Match (Months 4–9)
*Goal: full feature parity with IG, plus things IG can't do*

### 6. Society & Group Bookings
Golf societies (external groups booking a day out at a club) are a meaningful revenue stream. Build:
- Society enquiry form on club's public page
- Quote and invoice generation
- Tee sheet block booking
- Day-of scoring and results

### 7. Event Management
Club diary: dinners, AGMs, presentation evenings, social events. Members can:
- View upcoming events
- Book and pay for tickets (via Stripe)
- Select meal choices in advance

Admin can:
- Create events with capacity
- Track RSVPs and payments
- Generate guest lists

### 8. Push Notifications
Mobile push for:
- Competition results finalised
- Knockout draw announced (with opponent name)
- Tee time booking confirmed / reminder
- Message received
- Club announcements

### 9. Score Entry Kiosk (Web-based)
A tablet-optimised web app that lives in the clubhouse. Members tap their CDH number (or scan a barcode), enter their score hole-by-hole, submit. No hardware dependencies — runs on any iPad or Android tablet the club already owns.

### 10. Accounting Export
One-click Xero export of all financial transactions (entry fees, event tickets, membership payments). Saves the treasurer hours every month.

### 11. Embeddable Widgets
For clubs that want to keep their existing website:
- Live leaderboard embed
- Results archive embed
- Tee time booking widget
- Competition calendar

These are iframes or JavaScript snippets. Removes the objection "but we just redesigned our website."

---

## Phase 3 — Lead (Months 9–18)
*Goal: build the things IG cannot build — our permanent competitive advantage*

### 12. AI Member Insights (Club Admin)
The data we accumulate — round history, competition entries, tee time patterns, payment history — is uniquely valuable. Surface it intelligently:
- "3 members haven't engaged with any competition in 60 days — risk of lapsing"
- "Your Tuesday 7am slots have 60% lower fill rate than Saturday equivalent — suggest a £5 discount"
- "Your stableford competitions average 2.3 more entries than medal rounds — consider rebalancing the calendar"

### 13. AI Player Insights (Member App)
- Handicap trajectory ("You've improved 1.8 shots over 12 rounds — you're playing like a 14")
- Strength/weakness breakdown by format
- Head-to-head history with club members
- "Best round" and "worst round" analysis

### 14. Automated Competition Commentary
After a competition finalises, auto-generate a results summary: podium positions, notable scores (eagles, holes in one), most improved. Publish to the club feed and optionally to social media. Makes the club feel alive even when the secretary is busy.

### 15. Multi-Club Support
Members who belong to multiple clubs see everything in one app. Important for: county-level players, visiting members, and — eventually — our ability to sell to county golf unions (England Golf regional bodies) as a platform partner.

### 16. Analytics Dashboard (Claritee equivalent)
IG sells "Claritee" as an add-on benchmarking product. Build this natively:
- Revenue trends
- Member engagement over time
- Competition participation rates
- Tee time utilisation
- Benchmarking against anonymised peer clubs

---

## Pricing Strategy

IG reportedly charges in the region of **£90 per member per year** for their full suite.

Our pricing should reflect that we are genuinely better, not just cheaper. We are not competing on price alone — we're competing on product quality. But we will be meaningfully cheaper.

**Proposed model: per-member annual subscription, all-inclusive**

| Club size | Our price/member/year | Annual total | vs. IG (est.) |
|---|---|---|---|
| Up to 150 members | £18/member | £2,700 | Save ~£10,800 |
| 151–400 members | £16/member | £2,400–6,400 | Save ~£7,200–30,000 |
| 401–800 members | £14/member | £5,600–11,200 | Save ~£30,400–60,800 |
| 800+ members | Negotiated | — | — |

**What's included:** everything. No module pricing. No per-competition fees. No add-on charges for the comms module, the website widgets, or the analytics dashboard. One price, everything on.

**What we charge extra for:**
- Payment processing margin: 1% platform fee on all Stripe transactions through the app (entry fees, event tickets). Clubs pay Stripe's processing fee; we take 1% on top. Transparent and standard.
- Setup / onboarding: free. This is how we win the first conversation.

**Annual contract, cancel anytime.** No 3-year lock-ins like IG's enterprise deals.

---

## Go-to-Market

**Stage 1: Showcase club (now)**
Make our own club so demonstrably excellent on the platform that every visiting captain, secretary, or county officer who plays there asks "what system is this?" The captain's committee is the distribution channel.

**Stage 2: Warm referrals (months 2–4)**
Identified individuals in the club network who have connections to club secretaries or captains at other clubs. One personal introduction is worth fifty cold emails in this world. Target: 3–5 additional clubs signed before we spend a pound on marketing.

**Stage 3: England Golf ecosystem (months 4–12)**
Apply for ISV accreditation. Attend England Golf trade/club events. Get on the list of licensed software vendors — the same list as IG and Club V1. Clubs searching for alternatives see us.

**Stage 4: County unions (12+ months)**
England Golf operates through 38 county golf unions. A county-level deal — one contract that covers all affiliated clubs in a county — is the enterprise play. This requires the full product and a track record, but it's the path to hundreds of clubs at once.

---

## What We Need to Execute This

| Resource | Phase 1 | Phase 2–3 |
|---|---|---|
| Engineering | 1–2 developers (can move fast on this stack) | +1 developer |
| Sales / customer success | Founder-led (us) | 1 dedicated person |
| England Golf ISV licence | Apply now — £149/year + accreditation | Already live |
| Legal (company formation, contracts) | Needed before first paying club | Done |
| Design | Current quality is strong; maintain it | — |

**Capital requirement to Phase 1:** close to zero. The product is built. The ISV licence is £149. Hosting costs are negligible at this scale. The main investment is time.

**If we raise internally:** a small friends-and-family round of £50–100k would allow us to hire one salesperson and one additional developer, accelerating from "3 clubs" to "30 clubs" in the same timeframe.

---

## The Pitch in One Paragraph

*Intelligent Golf has 800 clubs, charges £90 per member per year, and hasn't materially innovated in a decade. We have a modern, beautifully designed platform that already does most of what they do, does some things they can't do at all, and will be fully feature-complete within six months. We're offering it at a fraction of their price, with no module pricing, no lock-in, and a product that members actually want to use. We have our first club. We have our first warm leads. We have a plan.*

---

*Next step: agree Phase 1 build order and set a target date for first paid club outside our own.*
