# Collaboration Guide — The 19th Hole

> How to split work between two developers using Claude Code without stepping on each other.

---

## Stack Quick Reference

- **Frontend** — Next.js 15 App Router, React 19, TailwindCSS, `src/app/`
- **Backend** — Convex (real-time DB + serverless functions), `convex/`
- **Auth** — Clerk (`useUser()`, `identity.subject` = userId)
- **Styling** — all Tailwind inline, no CSS files, light/dark via `bg-card`, `text-foreground` tokens

### Running locally

```bash
npm install
npx convex dev        # deploy schema + functions, keep in sync
npm run dev           # Next.js dev server on :3000
```

---

## The One Big Rule

**`convex/schema.ts` is the single biggest conflict surface.** Both developers must not edit it at the same time. Protocol:

1. Whoever needs to add a table does it in an isolated commit on their branch
2. Announce it in the group chat before merging
3. The other person pulls immediately before continuing work

---

## Work Split

### Developer A — Deepen existing features (mostly no new schema)

These work on tables that already exist. Safe to build in parallel.

| Feature | Files to touch | Notes |
|---|---|---|
| Competition check-in | `convex/entries.ts`, `src/app/manage/competitions/[id]/` | Add `checkedInAt` field to entries; show "Tee off" button on comp day |
| Competition waitlist | `convex/entries.ts` | Add `status: "waiting"` to entries; auto-promote when slot opens |
| Interclub availability | `convex/interclub.ts`, fixture detail page | Member says yes/no/maybe for a fixture; admin sees availability list |
| Knockout self-report | `convex/knockouts.ts`, `src/app/manage/knockouts/` | Member submits match result from phone; admin confirms |
| Financial CSV export | `src/app/manage/accounts/page.tsx` | Download button — no schema changes, just format existing transactions |
| Bar shift report | `src/app/manage/pos/page.tsx` | End-of-shift till summary; no schema changes |

### Developer B — New feature domains (need new schema)

Each of these needs new tables. Coordinate schema additions.

| Feature | New tables | Priority |
|---|---|---|
| Social / calendar events | `socialEvents`, `socialEventRsvps` | **Highest** — visible to all members |
| Club noticeboard | `clubNotices` | High — first thing members see |
| Individual golfer round tracking | extends `golferProfiles` | Medium — B2C growth |
| Public-facing club page improvements | none | Low — polish |

---

## Branching Strategy

```
main  ← always deployable
  ├── feature/dev-a/competition-checkin
  ├── feature/dev-a/waitlist
  ├── feature/dev-b/social-events     ← touches schema
  └── feature/dev-b/noticeboard       ← touches schema
```

- **Never push directly to `main`** — always PR
- **Feature branches** named `feature/<your-initials>/<feature>`
- Before merging a schema branch: announce, merge, other person pulls

---

## File Ownership Heuristic

Check `git log --oneline -5 <file>` before editing a file someone else has been working on. If in doubt, ping in the group chat.

**Safe to edit without checking:**
- Any new file you create
- `convex/schema.ts` — after announcement
- Your own feature pages

**Check before editing:**
- `src/components/layout/ManageSidebar.tsx` — both will need to add nav items; small conflict risk
- `convex/_generated/` — **never hand-edit**, always let `npx convex dev` regenerate

---

## Adding a Nav Item (ManageSidebar.tsx)

Pattern:
```tsx
// 1. Import the icon
import { Calendar } from "lucide-react";

// 2. Add NavItem in the right section (Club / Admin / etc.)
<NavItem href="/manage/events" icon={<Calendar size={16} />} label="Events" active={pathname.startsWith("/manage/events")} onClick={onNav} />
```

Sections in the sidebar (top → bottom):
- Platform (super admin only)
- Competitions
- Club (members, directory, tee times, visitors, POS, accounts)
- Admin (analytics, comms, courses)
- Account (messages, profile, billing)

---

## Key Routes

| Route | What it is |
|---|---|
| `/manage` | Club dashboard |
| `/manage/competitions/new` | Create competition wizard |
| `/manage/competitions/[id]` | Competition detail + entries |
| `/manage/competitions/[id]/scores` | Leaderboard + score entry |
| `/manage/knockouts` | Knockout brackets |
| `/manage/interclub` | County league management |
| `/manage/series` | Season series / points |
| `/manage/members` | Member management (admin) |
| `/manage/directory` | Member directory (all) |
| `/manage/tee-times` | Tee sheet (admin) or `/:slug/tee-times` (member) |
| `/manage/pos` | Bar/pro shop point of sale |
| `/manage/accounts` | Member pre-paid bar accounts |
| `/manage/profile` | Member self-service profile |
| `/manage/comms` | Bulk communications |
| `/kiosk/pos` | Full-screen POS kiosk |
| `/kiosk/scores` | Full-screen score entry kiosk |

---

## Priority Order for Maximum Product by Friday

Do the **highest visible-impact** items first:

| Priority | Developer | Feature |
|---|---|---|
| 1 | B | Social events (every member sees this) |
| 2 | A | Competition check-in + waitlist (comp day workflow) |
| 3 | B | Club noticeboard (first thing on dashboard) |
| 4 | A | Interclub availability (fixture workflow is incomplete without it) |
| 5 | B | Individual golfer stats (B2C growth) |
| 6 | A | Financial CSV export (treasurer will ask immediately) |

---

## Seeding Reference Data

The `golfClubs` directory table (Middlesex, Surrey, Herts clubs) needs to be seeded once per environment:

```bash
# Via Convex dashboard → Functions → golfClubs:seed → Run
# Or via the app if you're logged in as super admin
```

Clubs not in the seed list can be added inline when adding opposition teams to a league.
