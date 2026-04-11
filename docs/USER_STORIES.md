# Nineteenth Hole — User Stories
*Last updated: April 2026*

This document defines who uses the platform, what they need to do, and why. It is the primary reference for prioritising and scoping new features. Every story has a status so it is clear what is already built and what still needs to be done.

**Status key:**
- ✅ Built and live
- 🔨 Partially built / in progress
- ⬜ Not yet started
- 🔒 Blocked on external dependency (e.g. England Golf ISV licence)

---

## The Five Personas

| Persona | Who they are |
|---|---|
| **Individual Golfer** | A golfer with no club affiliation on this platform — discovers us via a friend's game or tour pool |
| **Club Member** | An active member of a club on the platform |
| **Club Admin / Secretary** | The person running the club — creates competitions, manages members, handles comms |
| **Pro Shop Staff** | Front-of-house staff managing the till, the tee sheet, score entry |
| **Bar Staff** | Behind the bar, running their own till and pre-paid accounts |

There is also a **Super Admin** persona (the platform operator — us) with visibility across all clubs, but that is an internal tool rather than a user-facing product.

---

## 1. Individual Golfer

The B2C wedge. They may not belong to a club on our platform, but they play golf and they want to track it. Getting them onto the platform is how we grow virally outside the club-sales channel.

### Scoring & Round History
- ✅ As an individual golfer, I want to enter my score hole-by-hole so that I have a record of every round I've played
- ✅ As an individual golfer, I want to see my gross score, net score, and stableford points for each round so that I understand how I played
- ⬜ As an individual golfer, I want to see a timeline of all my rounds so that I can track my progress over time
- ⬜ As an individual golfer, I want to see my scoring average per hole across all rounds so that I know exactly where I'm losing shots
- ⬜ As an individual golfer, I want to log which course and tee I played from so that my stats are meaningful across different tracks

### Handicap
- 🔒 As an individual golfer, I want my handicap index to update automatically when I submit a qualifying score so that I don't have to manage it manually
- ⬜ As an individual golfer, I want to see a chart of my handicap over time so that I can see whether I'm improving
- ⬜ As an individual golfer, I want to enter a self-declared handicap so that I can play games before my official index is established
- 🔒 As an individual golfer, I want to look up my England Golf CDH index so that I can use it to enter club competitions

### Games with Friends
- ✅ As an individual golfer, I want to create a quick game (stableford, strokeplay, skins, nassau, betterball) with friends so that we can track our match and settle any stakes
- ✅ As an individual golfer, I want to enter scores hole-by-hole during a quick game so that the leaderboard updates in real time
- ✅ As an individual golfer, I want to see the settlement at the end of the game so that I know who owes who

### Tour Pools & Sweeps
- ✅ As an individual golfer, I want to enter a major championship sweep so that I have a stake in watching the Masters / US Open / The Open
- ✅ As an individual golfer, I want to pick my five-player team for a pick-your-team pool so that I can compete on my knowledge of the field
- ✅ As an individual golfer, I want to see a live leaderboard of my pool updating as the tournament progresses so that I know where I stand

### Discovery & Joining a Club
- ⬜ As an individual golfer, I want to search for my club on the platform so that I can request membership and access their competitions
- ✅ As an individual golfer, I want to accept a membership invitation so that I can join my club's platform

---

## 2. Club Member

Everything an individual golfer can do, plus full participation in their club's activity.

### Competition Lifecycle
- ✅ As a club member, I want to see all upcoming competitions so that I know what's on and can plan ahead
- ✅ As a club member, I want to enter a competition and pay the entry fee online so that I don't have to bring cash
- ✅ As a club member, I want to see the draw result for a sweep or pool so that I know who my players are
- ✅ As a club member, I want to see the live leaderboard during a competition so that I know where I stand mid-round
- ✅ As a club member, I want to submit my scorecard hole-by-hole from my phone after a round so that I don't have to queue at the kiosk
- ✅ As a club member, I want to see my final result and position once the competition closes
- ⬜ As a club member, I want to join a waitlist if a competition is full so that I get a place automatically if someone drops out
- ⬜ As a club member, I want to be notified when the draw runs, when results are published, and when I win so that I never miss important news

### Tee Times
- ✅ As a club member, I want to book a tee time up to 7 days in advance so that I can plan my rounds
- ✅ As a club member, I want to see which slots are available and how full each one is so that I can choose the right time
- ✅ As a club member, I want to cancel a booking if my plans change so that the slot is freed up for someone else
- ✅ As a club member, I want to see the approximate sunset time when browsing tee times so that I don't book a late round I can't finish

### Social Events (non-competition)
- ⬜ As a club member, I want to see upcoming club social events (Prize Giving, Summer BBQ, Away Day, AGM) in one calendar so that I can plan my diary
- ⬜ As a club member, I want to RSVP to a social event so that the club knows I'm coming
- ⬜ As a club member, I want to pay for an event ticket online so that I don't have to bring cash on the night
- ⬜ As a club member, I want to add guest names to my booking so that everyone in my group is accounted for

### Club Noticeboard & Conditions
- ⬜ As a club member, I want to see today's course conditions at the top of my dashboard so that I know about temporary greens, preferred lies, or closures before I leave the house
- ⬜ As a club member, I want to receive a push notification when a course condition is posted so that I'm not caught out

### Member Community
- ✅ As a club member, I want to browse the member directory so that I can find other members' contact details
- ✅ As a club member, I want to send a direct message to another member so that I can arrange games without sharing personal phone numbers
- ✅ As a club member, I want to see group chats for the club so that I can follow club discussions
- ✅ As a club member, I want to update my profile, bio, and privacy settings so that I control what other members see

### Account & Wallet
- ✅ As a club member, I want to top up my pre-paid bar and pro shop account so that I can buy items without needing cash
- ✅ As a club member, I want to see my current account balance and recent transactions on my profile so that I know how much credit I have

### Season Series & Knockouts
- ✅ As a club member, I want to see the season series leaderboard so that I know where I stand in the overall points race
- ✅ As a club member, I want to see my knockout draw and who my opponent is so that I can arrange the match
- ⬜ As a club member, I want to submit the result of a knockout match from my phone so that the bracket updates automatically

### Interclub
- ✅ As a club member selected for an interclub team, I want to see my fixture details so that I know when and where to be
- ⬜ As a club member, I want to declare my availability for an upcoming interclub fixture so that the captain can build the team

---

## 3. Club Admin / Secretary

The admin's primary motivation is reducing time spent on admin. Every minute saved here is a minute they can spend on the game they love.

### Member Management
- ✅ As a club admin, I want to approve or reject membership requests so that only legitimate members join
- ✅ As a club admin, I want to assign roles (admin, staff, member) so that the right people have the right access
- ✅ As a club admin, I want to set membership categories (Full, Social, Junior, Senior) so that members are correctly classified
- ✅ As a club admin, I want to set a member's handicap so that it is available for scoring calculations
- ⬜ As a club admin, I want to export a CSV of all members with their handicap indices so that I can submit returns to England Golf
- ⬜ As a club admin, I want to bulk-import members from a spreadsheet so that onboarding a new club doesn't require manual entry

### Competition Management
- ✅ As a club admin, I want to create a competition (stableford, strokeplay, betterball, matchplay) with a date, entry fee, and prize structure so that members can enter and pay online
- ✅ As a club admin, I want to publish the competition when it is ready so that members can see it and enter
- ✅ As a club admin, I want to run the draw when entries close so that the sweep or pool is randomised fairly
- ✅ As a club admin, I want to enter competition scores on behalf of members so that I can process the results of board competitions
- ✅ As a club admin, I want to view the leaderboard in real time so that I can confirm results are correct before publishing
- ✅ As a club admin, I want to generate an AI-written results summary so that I can post it to the noticeboard or WhatsApp without writing it myself
- ⬜ As a club admin, I want to check members in on competition day so that no-shows are recorded and their slots can be reallocated
- ⬜ As a club admin, I want to manage a competition waitlist so that I don't have to administer dropouts manually over WhatsApp
- ⬜ As a club admin, I want to export competition results as a PDF or CSV so that I can post them on the physical noticeboard or submit to county

### Social Event Management
- ⬜ As a club admin, I want to create a social event (dinner, BBQ, away day, AGM) with a date, venue, capacity, and ticket price so that members can book online
- ⬜ As a club admin, I want to see the RSVP list in real time so that I know the headcount for catering
- ⬜ As a club admin, I want to export the guest list as a spreadsheet so that I can send it to the venue or caterer
- ⬜ As a club admin, I want to send a reminder to members who haven't yet responded so that the RSVP is as complete as possible

### Communications
- ✅ As a club admin, I want to send a bulk email to all members (or a filtered group) so that I can share results, news, and upcoming events without maintaining a separate mailing list
- ⬜ As a club admin, I want to schedule an email to go out at a specific date and time so that competition reminders go out automatically
- ⬜ As a club admin, I want to see who opened my email so that I know whether the message landed
- ⬜ As a club admin, I want to post a course condition notice that appears at the top of every member's dashboard so that everyone sees it immediately

### Tee Time Administration
- ✅ As a club admin, I want to generate tee time slots for a date range with configurable intervals so that I don't have to create them one by one
- ✅ As a club admin, I want to block individual slots (e.g. for greenkeeping) so that members cannot book them
- ✅ As a club admin, I want to see all bookings for a given day so that I can manage the tee sheet
- ✅ As a club admin, I want to set how far in advance members can book so that the tee sheet doesn't fill up too early
- ✅ As a club admin, I want to restrict visitor bookings to after a certain time on weekends so that member tee times are protected

### Financial Reporting
- ✅ As a club admin, I want to see a summary of today's POS sales (cash, card, account) so that I can reconcile the till
- ⬜ As a club admin, I want to see weekly and monthly revenue reports broken down by competition entry fees, POS, visitor fees, and event tickets so that the treasurer has what they need
- ⬜ As a club admin, I want to export financial transactions to a CSV so that I can import them into Xero or send them to the accountant

### Course Management
- ✅ As a club admin, I want to enter the course card (hole-by-hole par and stroke index) so that stableford calculations are correct
- ✅ As a club admin, I want to enter yardages per tee colour so that members can see the course from their tee

### Member Accounts
- ✅ As a club admin, I want to top up a member's pre-paid account so that they can use it at the bar and pro shop
- ✅ As a club admin, I want to see all member balances at a glance so that I know who is overdrawn
- ✅ As a club admin, I want to see the full transaction history for any member's account so that I can resolve disputes

---

## 4. Pro Shop Staff

The pro shop is the operational heart of competition day. Staff here are not power users — they need an interface that works fast under pressure.

### Score Entry Kiosk
- ✅ As a pro shop staff member, I want to open the score entry kiosk on a touchscreen so that members can enter their scores in the clubhouse
- ✅ As a pro shop staff member, I want to select today's competition from the kiosk home screen so that I don't need to navigate a complex menu
- ✅ As a pro shop staff member, I want to look up a member by name or membership number on the kiosk so that I can post their score quickly
- ✅ As a pro shop staff member, I want to enter hole-by-hole gross scores on a large-button interface so that it works reliably with fingers on a touchscreen
- ✅ As a pro shop staff member, I want to see the auto-calculated stableford total before confirming so that I can catch obvious data entry errors

### Point of Sale
- ✅ As a pro shop staff member, I want a full-screen touch POS with large product tiles so that I can process a sale quickly under pressure
- ✅ As a pro shop staff member, I want to search a member and charge their pre-paid account so that the transaction is cashless
- ✅ As a pro shop staff member, I want to take payment by cash or card as an alternative so that I can serve every customer
- ✅ As a pro shop staff member, I want to see a member's current balance before charging it so that I don't process a transaction that will fail
- ✅ As a pro shop staff member, I want to see a sale complete confirmation that auto-clears so that the screen is ready for the next customer without any extra taps

### Catalogue & Stock
- ✅ As a pro shop staff member, I want to add and edit products (name, price, stock level) so that the POS is always up to date
- ✅ As a pro shop staff member, I want stock to decrement automatically when an item is sold so that I don't have to update it manually
- ✅ As a pro shop staff member, I want to see low-stock indicators on product tiles so that I know when to reorder

### Tee Sheet & Visitors
- ✅ As a pro shop staff member, I want to see all bookings for today so that I can manage the starter's sheet
- ✅ As a pro shop staff member, I want to log a visitor's name, green fee, and home club so that there is a record of every round played
- ⬜ As a pro shop staff member, I want to check in a member for today's competition so that I know who has started and who is a no-show

### Member Accounts
- ✅ As a pro shop staff member, I want to top up a member's account when they hand over cash so that it is credited immediately
- ✅ As a pro shop staff member, I want to search a member by name or membership number to top up their account so that I don't have to scroll through a long list

---

## 5. Bar Staff

The bar operates largely independently from the pro shop. The till needs to be fast, simple, and focused on drinks and food.

### Point of Sale
- ✅ As a bar staff member, I want a full-screen touch POS with drink and food tiles so that I can process orders quickly
- ✅ As a bar staff member, I want to charge a member's pre-paid account so that cashless transactions are seamless
- ✅ As a bar staff member, I want a separate product catalogue for bar items (separate from pro shop) so that I'm not scrolling through golf equipment
- ⬜ As a bar staff member, I want to see a summary of cash, card, and account charges at the end of my shift so that I can reconcile the till before I go home

---

## Cross-Cutting Features (no single persona owns these)

### Notifications
- ⬜ As any user, I want to receive a push notification when something important happens (draw announced, score submitted, message received, event reminder) so that I don't have to keep checking the app

### Course Conditions / Noticeboard
- ⬜ As a club admin, I want to post a pinned notice (course condition, club announcement) that appears at the top of every member's view so that important information reaches everyone immediately
- ⬜ As a club member, I want to see the current notice when I open the app so that I am always up to date before I play

### Social / Calendar Events
- ⬜ The full event management feature (creation, RSVPs, payments, guest lists, reminders) is needed across Admin (creates), Member (books), and Pro Shop (checks in on the day). See Admin and Member stories above.

### Reporting & Exports
- ⬜ A shared reporting layer — financial summaries, competition exports, member lists, handicap returns — is needed by Admin and feeds into external systems (Xero, England Golf CDH).

### England Golf / WHS Integration
- 🔒 Once the ISV licence is approved, WHS handicap sync will affect Individual Golfer (handicap updates automatically), Club Member (qualifying scores submitted), and Club Admin (handicap management, CDH returns).

---

## Feature Status Summary

### Built ✅
Competition creation and management (stableford, strokeplay, betterball, matchplay, knockout, sweep, pick-your-team) · Live leaderboard · Score entry (admin, kiosk, member self-service) · Tee time booking (members and visitors) · Season series · Interclub league and fixtures · Member management and roles · Member directory · In-app messaging · Quick games (5 formats) · Tour pools · POS (manage and kiosk) · Member pre-paid accounts · Pro shop catalogue and stock · Visitor management · Bulk member communications · Course card management · AI results summaries · AI interclub team suggestions · Analytics dashboard

### In Progress 🔨
Kiosk score entry (built, needs competition check-in) · Kiosk POS (built, needs shift report)

### Not Yet Started ⬜
Social / calendar events · Course conditions / noticeboard · Competition waitlists · Competition check-in · Push notifications · Knockout availability / self-reported results · Shift till report (bar) · Financial exports (CSV / Xero) · Member handicap export (England Golf) · Bulk member import · Email scheduling and open tracking · Individual golfer round history and statistics · Per-hole analytics

### Blocked on External Dependency 🔒
WHS / England Golf CDH integration (pending ISV licence approval)

---

## What to Work On Next

Rough priority order based on impact and dependencies:

1. **Social / calendar events** — the single biggest gap vs Intelligent Golf that affects every member and admin. Schema → backend → member RSVP UI → admin creation/management UI.
2. **Course conditions / noticeboard** — highest-frequency admin action, most visible to members. Small schema change, simple UI.
3. **Competition check-in** — needed before we can claim to replace the pro shop's paper sheet on competition day.
4. **Push notifications** — multiplies the value of everything else. Use web push (no native app required).
5. **Financial exports** — treasurer / secretary asks for this on every club demo.
6. **Individual golfer round tracking & stats** — unlocks B2C growth independent of club sales.

---

## Tech Stack (for new contributors)

| Layer | Technology |
|---|---|
| Frontend | Next.js 19, React 19, TypeScript, Tailwind CSS |
| Backend / database | Convex (real-time, serverless, TypeScript functions) |
| Auth | Clerk |
| Payments | Stripe |
| AI | Anthropic Claude API (via Convex actions) |
| Hosting | Vercel (frontend) + Convex cloud (backend) |
| Icons | Lucide React |

**Key conventions:**
- All Convex functions live in `convex/` — queries, mutations, and actions
- Schema is defined in `convex/schema.ts` — change this first, then write the functions
- After changing the schema or functions, run `npx convex dev` to push to the cloud
- All pages are in `src/app/` following Next.js App Router conventions
- Shared components are in `src/components/`
- The `convex/_generated/` directory is auto-generated — do not edit it manually (except `api.d.ts` when the dev server isn't running)

**Key routes:**
```
/manage                          Club dashboard (auth required)
/manage/competitions/new         Create a competition
/manage/competitions/[id]/scores Admin score management + member self-entry
/manage/members                  Member management (admin only)
/manage/accounts                 Member pre-paid accounts (staff+)
/manage/pos                      POS (manage view, staff+)
/manage/tee-times                Tee time admin
/manage/analytics                Club analytics
/kiosk/pos                       Full-screen touch POS terminal
/kiosk/scores                    Full-screen touch score entry kiosk
/[clubSlug]/tee-times            Member-facing tee time booking
```

**To get started locally:**
```bash
pnpm install
npx convex dev          # starts the Convex dev server (keep this running)
pnpm dev                # starts Next.js
```
