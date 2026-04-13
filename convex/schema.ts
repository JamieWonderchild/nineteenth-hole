import { v } from "convex/values";
import { defineSchema, defineTable } from "convex/server";

export default defineSchema({
  // ============================================================================
  // Clubs & Membership
  // ============================================================================

  // ============================================================================
  // Individual Golfer Profiles (B2C — no club affiliation required)
  // ============================================================================

  golferProfiles: defineTable({
    userId: v.string(),                       // Clerk user ID
    displayName: v.string(),
    handicapIndex: v.optional(v.number()),    // self-reported WHS index
    homeClub: v.optional(v.string()),         // "Finchley Golf Club" (plain text)
    goals: v.optional(v.string()),            // 'casual' | 'competitive' | 'social'
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),

  // England Golf / county golf club directory — seed data, not platform accounts
  golfClubs: defineTable({
    name: v.string(),                       // "Finchley Golf Club"
    county: v.string(),                     // "Middlesex"
    englandGolfId: v.optional(v.string()),  // CDH club number
    postcode: v.optional(v.string()),       // "N3 3JH"
    website: v.optional(v.string()),
    platformClubId: v.optional(v.id("clubs")), // set when club joins the platform
  })
    .index("by_county", ["county"])
    .index("by_name", ["name"])
    .index("by_platform_club", ["platformClubId"]),

  clubs: defineTable({
    name: v.string(),
    slug: v.string(),           // URL-safe identifier e.g. "royal-troon-gc"
    clerkOrgId: v.optional(v.string()),
    // Location / county affiliation
    county: v.optional(v.string()),          // "Middlesex"
    englandGolfId: v.optional(v.string()),   // CDH club number
    golfClubId: v.optional(v.id("golfClubs")), // link to directory entry
    // Branding
    logoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    // Billing
    plan: v.string(),           // 'free' | 'club'
    billingStatus: v.string(),  // 'trialing' | 'active' | 'past_due' | 'canceled'
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    trialEndsAt: v.optional(v.string()),
    // Settings
    currency: v.string(),       // 'GBP' | 'EUR' | 'USD'
    defaultEntryFee: v.optional(v.number()), // in pence/cents
    // Tee time policy
    advanceBookingDays: v.optional(v.number()),       // how far ahead members can book (default 7)
    weekendVisitorStartTime: v.optional(v.string()),  // e.g. "11:00" — visitors blocked before this on weekends
    latitude: v.optional(v.number()),                 // for sunset calculation
    longitude: v.optional(v.number()),
    // Data import — scoped token for Alan's results scraper (not a global secret)
    importToken: v.optional(v.string()),
    // Timestamps
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_clerk_org", ["clerkOrgId"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_import_token", ["importToken"]),

  // Membership categories (Full, Weekday, Junior, Social, etc.)
  membershipCategories: defineTable({
    clubId: v.id("clubs"),
    name: v.string(),                              // "Full Member", "Weekday Member", etc.
    colour: v.string(),                            // "green" | "blue" | "amber" | "purple" | "gray"
    advanceBookingDays: v.optional(v.number()),    // overrides club default when set
    canBookWeekends: v.optional(v.boolean()),      // false = weekday only
    bookingStartTime: v.optional(v.string()),      // e.g. "09:00" — earliest allowed tee time
    competitionEligible: v.optional(v.boolean()),  // false = cannot enter club competitions
    sortOrder: v.optional(v.number()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_club", ["clubId"]),

  // Club members — one row per (club, user) pair
  // Accumulates stats across all competitions at this club
  clubMembers: defineTable({
    clubId: v.id("clubs"),
    userId: v.string(),         // Clerk user ID
    role: v.string(),           // 'admin' | 'member'
    status: v.string(),         // 'pending' | 'active'
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    // Cumulative stats — updated whenever a competition resolves
    totalEntered: v.number(),   // number of competitions entered
    totalSpent: v.number(),     // total entry fees paid (pence/cents)
    totalWon: v.number(),       // total prize money received (pence/cents)
    totalProfit: v.number(),    // totalWon - totalSpent (can be negative)
    bestFinish: v.optional(v.number()), // best leaderboard position (1 = winner)
    // External system linkage — used when importing from club website data
    fgcMemberId: v.optional(v.string()), // Finchley Golf Club member ID (from Alan's scraper)
    // Timestamps
    joinedAt: v.string(),
    updatedAt: v.string(),
    // Member directory profile (optional, member-controlled)
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    bio: v.optional(v.string()),
    membershipCategory: v.optional(v.string()),         // legacy plain text display name
    membershipCategoryId: v.optional(v.id("membershipCategories")), // structured category
    directoryVisible: v.optional(v.boolean()),  // default true when absent
    showPhone: v.optional(v.boolean()),
    showEmail: v.optional(v.boolean()),
    // Club roles — cosmetic titles assigned by admin (separate from system role)
    // e.g. ["captain", "secretary", "committee", "treasurer", "competition_secretary"]
    clubRoles: v.optional(v.array(v.string())),
    // Handicap — manually set by admin until WHS API integration
    handicap: v.optional(v.number()),           // e.g. 14.2
    // Member account (pre-paid credit for bar/pro shop)
    accountBalance: v.optional(v.number()),     // pence — undefined treated as 0
  })
    .index("by_club", ["clubId"])
    .index("by_club_and_user", ["clubId", "userId"])
    .index("by_club_and_status", ["clubId", "status"])
    .index("by_club_and_fgc_member", ["clubId", "fgcMemberId"])
    .index("by_user", ["userId"])
    .index("by_club_total_won", ["clubId", "totalWon"]),

  // ============================================================================
  // Competitions (Tour Pools + Club Events)
  // ============================================================================

  competitions: defineTable({
    // clubId is null for platform-wide tour pools (e.g. Masters sweep)
    clubId: v.optional(v.id("clubs")),
    // 'platform' = super admin created, open to all users
    // 'club'     = club admin created, for club members
    scope: v.optional(v.string()),
    name: v.string(),           // "Masters 2026 Pool"
    slug: v.string(),           // URL segment
    description: v.optional(v.string()),
    status: v.string(),         // 'draft' | 'open' | 'live' | 'complete'
    // Tournament info
    type: v.string(),           // 'major' | 'tour' | 'ryder_cup' | 'club_comp' | 'custom'
    tournamentRef: v.optional(v.string()), // e.g. "masters-2026" for score feed lookup
    startDate: v.string(),      // ISO date of R1
    endDate: v.string(),        // ISO date of final round
    entryDeadline: v.string(),  // ISO datetime — draw runs after this
    // Draw config
    // 'tiered' | 'random' | 'draft' | 'pick' (pick = members choose their own players)
    drawType: v.string(),
    tierCount: v.number(),      // how many tiers (usually 3; 0 for pick format)
    playersPerTier: v.number(), // how many players per tier (0 for pick format)
    // Pick-format config (drawType === 'pick')
    pickCount: v.optional(v.number()),   // how many players each entrant picks (default 5)
    reserveCount: v.optional(v.number()), // how many reserves (default 1)
    // Financials
    entryFee: v.number(),       // in pence/cents
    currency: v.string(),
    prizeStructure: v.array(v.object({
      position: v.number(),
      percentage: v.number(),   // e.g. 55 for 55%
    })),
    // Club event scoring format (only relevant when type === 'club_comp')
    // 'stableford' | 'strokeplay' | 'betterball' | 'matchplay' | 'custom'
    scoringFormat: v.optional(v.string()),
    // Course this competition is played on — used for hole-by-hole stableford calc
    courseId: v.optional(v.id("courses")),
    roundHoles: v.optional(v.number()),   // 9 or 18 (default 18)
    // Metadata
    drawCompletedAt: v.optional(v.string()),
    // 'stripe' (default) | 'cash' — cash means admin marks entries as paid manually
    paymentCollection: v.optional(v.string()),
    createdBy: v.string(),      // Clerk user ID
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_club", ["clubId"])
    .index("by_club_and_slug", ["clubId", "slug"])
    .index("by_slug", ["slug"])          // global slug lookup (platform pools)
    .index("by_scope", ["scope"])        // list all platform pools
    .index("by_status", ["status"]),

  // ============================================================================
  // Players (per competition)
  // ============================================================================

  players: defineTable({
    competitionId: v.id("competitions"),
    name: v.string(),
    tier: v.number(),           // 1 | 2 | 3
    worldRanking: v.optional(v.number()),
    country: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // Scores — updated each round
    r1: v.optional(v.number()),
    r2: v.optional(v.number()),
    r3: v.optional(v.number()),
    r4: v.optional(v.number()),
    totalScore: v.optional(v.number()),  // cumulative strokes
    scoreToPar: v.optional(v.number()),  // negative = under par
    position: v.optional(v.number()),    // current leaderboard position
    madeCut: v.optional(v.boolean()),
    withdrawn: v.optional(v.boolean()),
    // Prize money (for pick-format competitions scored by prize money)
    prizeMoney: v.optional(v.number()), // in pence/cents
    // External IDs for score feed matching
    espnPlayerId: v.optional(v.string()),
  })
    .index("by_competition", ["competitionId"])
    .index("by_competition_and_tier", ["competitionId", "tier"]),

  // ============================================================================
  // Entries (into competitions)
  // ============================================================================

  entries: defineTable({
    competitionId: v.id("competitions"),
    clubId: v.optional(v.id("clubs")), // null for platform pool entries
    userId: v.string(),         // Clerk user ID
    displayName: v.string(),
    // Payment
    paidAt: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeCheckoutSessionId: v.optional(v.string()),
    // Drawn players — populated after draw ceremony (or chosen players for pick format)
    drawnPlayerIds: v.optional(v.array(v.id("players"))), // one per tier, or N for pick
    // Reserve picks (pick format only) — activated if two entries share same 5 picks
    reservePlayerIds: v.optional(v.array(v.id("players"))),
    // Computed standings — updated as scores come in
    bestPlayerScore: v.optional(v.number()), // scoreToPar of their best player
    bestPlayerPosition: v.optional(v.number()),
    leaderboardPosition: v.optional(v.number()),
    // Prize money total (pick format — sum of picked players' prizeMoney)
    totalPrizeMoney: v.optional(v.number()), // pence/cents
    // Prize
    prizeWon: v.optional(v.number()), // pence/cents, set on competition complete
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_competition", ["competitionId"])
    .index("by_competition_and_user", ["competitionId", "userId"])
    .index("by_club", ["clubId"])
    .index("by_user", ["userId"])
    .index("by_stripe_session", ["stripeCheckoutSessionId"]),

  // ============================================================================
  // Golf Courses (par + stroke index per hole — used for scoring calc)
  // ============================================================================

  courses: defineTable({
    clubId: v.id("clubs"),
    name: v.string(),           // "Main Course"
    holes: v.array(v.object({
      number: v.number(),       // 1–18
      par: v.number(),          // 3 | 4 | 5
      strokeIndex: v.number(),  // 1–18 (1 = hardest)
      yards: v.optional(v.number()),        // legacy
      yardsWhite: v.optional(v.number()),
      yardsYellow: v.optional(v.number()),
      yardsBlue: v.optional(v.number()),
      yardsRed: v.optional(v.number()),
    })),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_club", ["clubId"]),

  // ============================================================================
  // Quick Games (informal rounds between friends)
  // ============================================================================

  quickGames: defineTable({
    createdBy: v.string(),      // Clerk user ID
    name: v.string(),           // "Saturday fourball", "The Ward 2026"
    // 'stableford' | 'strokeplay' | 'betterball' | 'skins' | 'nassau' | 'custom'
    type: v.string(),
    status: v.string(),         // 'setup' | 'active' | 'complete'
    currency: v.string(),       // 'GBP' | 'EUR' | 'USD'
    // Scoring mode
    scoringMode: v.optional(v.string()),   // 'overall' | 'per_hole'
    courseId: v.optional(v.id("courses")), // linked course for auto-calc
    teeColour: v.optional(v.string()),     // 'white' | 'yellow' | 'blue' | 'red'
    // Stake — how the money works
    stakePerPlayer: v.number(), // in pence/cents per player (0 = just for fun)
    settlementType: v.string(), // 'cash' | 'stripe'
    // Players — stored inline for quick games (no club membership needed)
    players: v.array(v.object({
      id: v.string(),           // nanoid
      name: v.string(),
      userId: v.optional(v.string()), // Clerk ID if they're on the platform
      handicap: v.optional(v.number()),
    })),
    // Pairs (for betterball / nassau) — array of [playerId, playerId]
    pairings: v.optional(v.array(v.array(v.string()))),
    // Scores entered after the round
    scores: v.optional(v.array(v.object({
      playerId: v.string(),
      gross: v.optional(v.number()),      // total gross strokes
      net: v.optional(v.number()),        // total net (after handicap)
      points: v.optional(v.number()),     // total stableford points
      // Per-hole breakdown (populated when scoringMode === 'per_hole')
      holeScores: v.optional(v.array(v.object({
        hole: v.number(),
        gross: v.number(),
      }))),
    }))),
    // Result computed when completed
    result: v.optional(v.object({
      winnerIds: v.array(v.string()),     // player IDs who won
      settlement: v.array(v.object({
        fromName: v.string(),
        toName: v.string(),
        amount: v.number(),               // pence/cents
      })),
      summary: v.string(),               // "Jamie wins with 36 points"
    })),
    date: v.string(),           // ISO date of the round
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_creator", ["createdBy"])
    .index("by_status", ["status"]),

  // ============================================================================
  // Season Series (cumulative points across club events)
  // ============================================================================

  series: defineTable({
    clubId: v.id("clubs"),
    name: v.string(),           // "Race to Swinley Forest 2026"
    description: v.optional(v.string()),
    status: v.string(),         // 'active' | 'complete'
    season: v.string(),         // '2026'
    pointsStructure: v.array(v.object({
      position: v.number(),
      points: v.number(),       // e.g. 1st = 10pts, 2nd = 8pts, ...
    })),
    prizePool: v.optional(v.number()), // pence/cents — optional season end prize
    currency: v.string(),
    createdBy: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_club", ["clubId"]),

  // Competitions that count toward a series
  seriesCompetitions: defineTable({
    seriesId: v.id("series"),
    competitionId: v.id("competitions"),
    // 'major' | 'medal' | 'stableford' | 'knockout' | 'trophy'
    category: v.string(),
    isPairsEvent: v.optional(v.boolean()), // trophy pairs events get ÷2 points
    weight: v.optional(v.number()),
    addedAt: v.string(),
  })
    .index("by_series", ["seriesId"])
    .index("by_competition", ["competitionId"]),

  // ============================================================================
  // Side Bets (optional pots within a competition)
  // ============================================================================

  sideBets: defineTable({
    competitionId: v.id("competitions"),
    clubId: v.optional(v.id("clubs")),
    name: v.string(),           // "Eagle Watch", "Top Brit", etc.
    type: v.string(),           // 'eagle_watch' | 'top_nationality' | 'prediction' | 'first_leader' | 'hole_in_one' | 'custom'
    description: v.string(),
    entryFee: v.number(),       // pence/cents
    status: v.string(),         // 'open' | 'settled'
    winnerId: v.optional(v.string()), // Clerk user ID of winner
    createdAt: v.string(),
  })
    .index("by_competition", ["competitionId"]),

  sideBetEntries: defineTable({
    sideBetId: v.id("sideBets"),
    userId: v.string(),
    predictionValue: v.optional(v.string()), // e.g. "-15" for winning score guess
    paidAt: v.optional(v.string()),
    won: v.optional(v.boolean()),
    createdAt: v.string(),
  })
    .index("by_side_bet", ["sideBetId"])
    .index("by_user", ["userId"]),

  // ============================================================================
  // ============================================================================
  // Tee Time Bookings
  // ============================================================================

  teeTimeSlots: defineTable({
    clubId: v.id("clubs"),
    date: v.string(),           // "2026-04-12"
    time: v.string(),           // "07:00"
    maxPlayers: v.number(),     // typically 4
    isBlocked: v.optional(v.boolean()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_club", ["clubId"])
    .index("by_club_and_date", ["clubId", "date"]),

  teeTimeBookings: defineTable({
    clubId: v.id("clubs"),
    slotId: v.id("teeTimeSlots"),
    date: v.string(),           // denormalised for easy querying
    time: v.string(),           // denormalised
    userId: v.optional(v.string()),   // undefined for visitor bookings
    displayName: v.string(),
    playerCount: v.number(),    // 1–4
    notes: v.optional(v.string()),
    status: v.string(),         // "confirmed" | "cancelled"
    // Visitor fields
    bookingType: v.optional(v.string()),      // "member" | "visitor"
    visitorEmail: v.optional(v.string()),
    visitorPhone: v.optional(v.string()),
    visitorHomeClub: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_club", ["clubId"])
    .index("by_slot", ["slotId"])
    .index("by_club_and_date", ["clubId", "date"])
    .index("by_user", ["userId"])
    .index("by_club_and_user", ["clubId", "userId"]),

  // ============================================================================
  // Member account transactions (pre-paid bar/pro shop credit)
  // ============================================================================

  memberAccountTransactions: defineTable({
    clubId: v.id("clubs"),
    memberId: v.id("clubMembers"),
    userId: v.string(),                        // Clerk ID — denormalised
    type: v.string(),                          // "topup" | "charge" | "refund" | "adjustment"
    amount: v.number(),                        // pence — positive = credit, negative = debit
    balanceAfter: v.number(),                  // pence — running balance after this tx
    description: v.string(),                   // "Bar purchase" | "Account top-up"
    saleId: v.optional(v.id("posSales")),      // linked POS sale when type = "charge"
    processedBy: v.string(),                   // userId of staff/admin
    createdAt: v.string(),
  })
    .index("by_club", ["clubId"])
    .index("by_member", ["memberId"])
    .index("by_club_and_member", ["clubId", "memberId"]),

  // Webhook idempotency
  // ============================================================================

  webhookEvents: defineTable({
    eventId: v.string(),
    source: v.string(),         // 'stripe' | 'clerk'
    processedAt: v.string(),
  })
    .index("by_event_id", ["eventId"]),

  // ============================================================================
  // Visitors
  // ============================================================================

  visitors: defineTable({
    clubId: v.id("clubs"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    homeClub: v.optional(v.string()),
    date: v.string(),                          // ISO date of visit
    greenFee: v.optional(v.number()),          // pence/cents
    currency: v.string(),
    paidAt: v.optional(v.string()),
    slotId: v.optional(v.id("teeTimeSlots")),
    notes: v.optional(v.string()),
    loggedBy: v.string(),                      // userId
    createdAt: v.string(),
  })
    .index("by_club", ["clubId"])
    .index("by_club_and_date", ["clubId", "date"]),

  // ============================================================================
  // Knockout Competitions
  // ============================================================================

  knockoutTournaments: defineTable({
    clubId: v.id("clubs"),
    name: v.string(),
    status: v.string(),            // 'draft' | 'active' | 'complete'
    format: v.string(),            // 'single_elimination'
    seeded: v.optional(v.boolean()),
    currentRound: v.number(),      // 1-based
    totalRounds: v.number(),
    createdBy: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_club", ["clubId"]),

  knockoutEntrants: defineTable({
    tournamentId: v.id("knockoutTournaments"),
    userId: v.optional(v.string()),   // null for byes
    displayName: v.string(),
    seed: v.optional(v.number()),
    eliminated: v.optional(v.boolean()),
    eliminatedRound: v.optional(v.number()),
  })
    .index("by_tournament", ["tournamentId"]),

  knockoutMatches: defineTable({
    tournamentId: v.id("knockoutTournaments"),
    round: v.number(),             // 1 = first round
    matchNumber: v.number(),       // position in bracket
    playerAId: v.optional(v.id("knockoutEntrants")),
    playerBId: v.optional(v.id("knockoutEntrants")),
    winnerId: v.optional(v.id("knockoutEntrants")),
    scoreA: v.optional(v.string()), // e.g. "2&1" or "3/2"
    scoreB: v.optional(v.string()),
    scheduledDate: v.optional(v.string()),
    completedAt: v.optional(v.string()),
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_tournament_and_round", ["tournamentId", "round"]),

  // ============================================================================
  // Communications (bulk emails sent to members)
  // ============================================================================

  communications: defineTable({
    clubId: v.id("clubs"),
    sentBy: v.string(),              // userId
    subject: v.string(),
    body: v.string(),                // plain text / markdown
    recipientFilter: v.string(),     // 'all' | 'active' | 'admins'
    recipientCount: v.number(),
    sentAt: v.string(),
  })
    .index("by_club", ["clubId"]),

  // ============================================================================
  // Member Invitations (email-based, one-time-use)
  // ============================================================================

  invites: defineTable({
    clubId: v.id("clubs"),
    email: v.string(),          // recipient email address
    token: v.string(),          // unique 32-char random token
    invitedBy: v.string(),      // Clerk userId of admin who sent it
    createdAt: v.string(),
    expiresAt: v.string(),      // 7 days from creation
    usedAt: v.optional(v.string()),
    usedByUserId: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_club", ["clubId"]),

  // ============================================================================
  // Messaging
  // ============================================================================

  conversations: defineTable({
    type: v.string(),                       // 'direct' | 'group'
    clubId: v.optional(v.id("clubs")),      // set for club group chats
    name: v.optional(v.string()),           // group chat name
    createdBy: v.string(),                  // userId
    lastMessageAt: v.optional(v.string()),  // ISO — for sorting
    createdAt: v.string(),
  })
    .index("by_club", ["clubId"]),

  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.string(),
    displayName: v.string(),               // denormalised for display
    avatarUrl: v.optional(v.string()),
    lastReadAt: v.optional(v.string()),    // ISO — for unread count
    joinedAt: v.string(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_conversation_and_user", ["conversationId", "userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(),
    senderName: v.string(),
    senderAvatar: v.optional(v.string()),
    body: v.string(),
    createdAt: v.string(),
  })
    .index("by_conversation", ["conversationId"]),

  // ============================================================================
  // Club Competition Scoring
  // ============================================================================

  competitionScores: defineTable({
    competitionId: v.id("competitions"),
    clubId: v.id("clubs"),
    userId: v.optional(v.string()),      // Clerk userId — optional for guest entries
    displayName: v.string(),
    handicap: v.number(),                // handicap at time of entry
    grossScore: v.optional(v.number()),  // total gross strokes
    netScore: v.optional(v.number()),    // gross - handicap (computed or manual)
    stablefordPoints: v.optional(v.number()), // for stableford format
    countback: v.optional(v.string()),   // e.g. "32 (back 9)" for tiebreak display
    notes: v.optional(v.string()),
    position: v.optional(v.number()),    // computed rank on leaderboard
    // Per-hole breakdown (populated from kiosk or in-app hole-by-hole entry)
    holeScores: v.optional(v.array(v.object({ hole: v.number(), gross: v.number() }))),
    submittedAt: v.string(),
    submittedBy: v.string(),             // userId of who entered the score
  })
    .index("by_competition", ["competitionId"])
    .index("by_competition_and_user", ["competitionId", "userId"])
    .index("by_club", ["clubId"]),

  // ============================================================================
  // Interclub Competitions (County League / Matchplay)
  // ============================================================================

  interclubLeagues: defineTable({
    name: v.string(),               // "Middlesex County League"
    county: v.optional(v.string()), // "Middlesex"
    season: v.string(),             // "2025-26"
    format: v.string(),             // 'matchplay' | 'stableford' | 'strokeplay'
    matchType: v.optional(v.string()), // 'singles' | 'betterball' | 'mixed'
    handicapMin: v.optional(v.number()), // min handicap for this league (e.g. 5.5 for Sabres)
    handicapMax: v.optional(v.number()), // max handicap (null = no limit)
    description: v.optional(v.string()),
    createdBy: v.string(),          // userId
    createdAt: v.string(),
  }),

  interclubTeams: defineTable({
    leagueId: v.id("interclubLeagues"),
    clubId: v.optional(v.id("clubs")),       // set if team is a platform customer
    golfClubId: v.optional(v.id("golfClubs")), // set from directory
    clubName: v.string(),           // denormalised display name
    teamName: v.string(),           // "Sabres", "Tigers", "Foxes"
    handicapMin: v.optional(v.number()), // lower bound of handicap band
    handicapMax: v.optional(v.number()), // upper bound
    captainUserId: v.optional(v.string()), // the league rep / team captain
    createdAt: v.string(),
  })
    .index("by_league", ["leagueId"])
    .index("by_club", ["clubId"])
    .index("by_league_and_club", ["leagueId", "clubId"]),

  interclubFixtures: defineTable({
    leagueId: v.id("interclubLeagues"),
    homeTeamId: v.id("interclubTeams"),
    awayTeamId: v.id("interclubTeams"),
    date: v.optional(v.string()),   // ISO date
    venue: v.optional(v.string()),  // "Finchley Golf Club" or "away"
    status: v.string(),             // 'scheduled' | 'in_progress' | 'complete' | 'postponed'
    homePoints: v.optional(v.number()),
    awayPoints: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_league", ["leagueId"])
    .index("by_home_team", ["homeTeamId"])
    .index("by_away_team", ["awayTeamId"]),

  interclubMatches: defineTable({
    fixtureId: v.id("interclubFixtures"),
    leagueId: v.id("interclubLeagues"),
    matchNumber: v.number(),        // 1–8 (singles) or 1–4 (betterball)
    matchType: v.optional(v.string()), // 'singles' | 'betterball' — overrides league default
    homePlayer: v.string(),         // display name (player 1)
    homePlayer2: v.optional(v.string()), // partner name (betterball only)
    homeUserId: v.optional(v.string()),
    homeUserId2: v.optional(v.string()),
    awayPlayer: v.string(),
    awayPlayer2: v.optional(v.string()),
    awayUserId: v.optional(v.string()),
    awayUserId2: v.optional(v.string()),
    result: v.optional(v.string()), // e.g. "3&2", "1 up", "halved", "conceded"
    // 'home' | 'away' | 'halved' | null
    winner: v.optional(v.string()),
    homePoints: v.optional(v.number()), // 1 for win, 0.5 for half, 0
    awayPoints: v.optional(v.number()),
  })
    .index("by_fixture", ["fixtureId"])
    .index("by_league", ["leagueId"]),

  // Squad membership — links a club member to an interclub team
  squadMembers: defineTable({
    teamId: v.id("interclubTeams"),
    clubId: v.id("clubs"),              // denormalised for easy querying
    memberId: v.id("clubMembers"),      // the club member
    status: v.string(),                 // 'invited' | 'active' | 'declined' | 'removed'
    invitedBy: v.string(),              // userId of captain who sent the invite
    invitedAt: v.string(),
    respondedAt: v.optional(v.string()),
  })
    .index("by_team", ["teamId"])
    .index("by_member", ["memberId"])
    .index("by_club", ["clubId"])
    .index("by_team_and_member", ["teamId", "memberId"]),

  // Fixture availability — squad member's response to a fixture call-up
  fixtureAvailability: defineTable({
    fixtureId: v.id("interclubFixtures"),
    teamId: v.id("interclubTeams"),
    memberId: v.id("clubMembers"),
    status: v.string(),                 // 'available' | 'unavailable' | 'tentative'
    note: v.optional(v.string()),
    updatedAt: v.string(),
  })
    .index("by_fixture", ["fixtureId"])
    .index("by_member", ["memberId"])
    .index("by_fixture_and_team", ["fixtureId", "teamId"])
    .index("by_fixture_and_member", ["fixtureId", "memberId"]),

  // ============================================================================
  // Point of Sale — Pro Shop & Bar
  // ============================================================================

  // Physical areas of the club (Bar, Pro Shop, Restaurant, Halfway House, etc.)
  // Sits above posCategories in the hierarchy: Location → Category → Product
  posLocations: defineTable({
    clubId:      v.id("clubs"),
    name:        v.string(),              // "Bar", "Pro Shop", "Halfway House"
    description: v.optional(v.string()),
    isActive:    v.boolean(),
    sortOrder:   v.number(),
    createdAt:   v.string(),
  })
    .index("by_club", ["clubId"]),

  // Named physical devices (tills/tablets) registered to a club and location
  // Device identity is fixed — multiple staff share the same kiosk login
  posKiosks: defineTable({
    clubId:     v.id("clubs"),
    locationId: v.id("posLocations"),
    name:       v.string(),              // "Bar Till 1", "Pro Shop Counter"
    pinHash:    v.optional(v.string()),  // SHA-256 hash of manager PIN for lock screen
    isActive:   v.boolean(),
    lastSeenAt: v.optional(v.string()), // ISO — updated on heartbeat or each sale
    createdAt:  v.string(),
  })
    .index("by_club",     ["clubId"])
    .index("by_location", ["locationId"]),

  // A shift represents one period of service at a location
  // Contains opening and closing stock takes, and scopes all sales within it
  posShifts: defineTable({
    clubId:     v.id("clubs"),
    locationId: v.id("posLocations"),
    kioskId:    v.optional(v.id("posKiosks")), // which device opened the shift
    openedBy:   v.string(),              // userId
    closedBy:   v.optional(v.string()), // userId
    status:     v.string(),             // "open" | "closed"
    openedAt:   v.string(),             // ISO datetime
    closedAt:   v.optional(v.string()),
    notes:      v.optional(v.string()),
    createdAt:  v.string(),
  })
    .index("by_club",            ["clubId"])
    .index("by_location",        ["locationId"])
    .index("by_club_and_status", ["clubId", "status"]),

  // A snapshot of physical stock counts taken at the start, end, or mid-shift (spot).
  // Opening + closing enables variance calc; spot takes are mid-shift checks.
  posStockTakes: defineTable({
    clubId:       v.id("clubs"),
    locationId:   v.id("posLocations"),
    shiftId:      v.id("posShifts"),
    type:         v.string(),             // "opening" | "closing" | "spot"
    takenBy:      v.string(),             // userId / kiosk actor
    takenByName:  v.string(),             // human-entered staff name
    takenAt:      v.string(),             // ISO datetime
    counts:       v.array(v.object({
      productId:    v.id("posProducts"),
      productName:  v.string(),           // denormalised — survives product deletion/rename
      countedUnits: v.number(),
    })),
    notes:        v.optional(v.string()),
    createdAt:    v.string(),
  })
    .index("by_club",     ["clubId"])
    .index("by_shift",    ["shiftId"])
    .index("by_location", ["locationId"]),

  posCategories: defineTable({
    clubId:     v.id("clubs"),
    name:       v.string(),               // "Pints", "Spirits", "Soft Drinks", "Clothing"
    icon:       v.optional(v.string()),   // emoji e.g. "🍺"
    sortOrder:  v.number(),
    locationId: v.optional(v.id("posLocations")), // which location this category belongs to
    createdAt:  v.string(),
  })
    .index("by_club",     ["clubId"])
    .index("by_location", ["locationId"]),

  posProducts: defineTable({
    clubId:      v.id("clubs"),
    categoryId:  v.optional(v.id("posCategories")),
    locationId:  v.optional(v.id("posLocations")), // which location this product belongs to
    name:        v.string(),
    sku:         v.optional(v.string()),
    description: v.optional(v.string()),
    pricePence:  v.number(),              // always stored in smallest currency unit
    currency:    v.string(),
    imageUrl:    v.optional(v.string()),
    trackStock:  v.optional(v.boolean()), // if true, stockCount is maintained
    stockCount:  v.optional(v.number()),
    isActive:    v.boolean(),
    createdAt:   v.string(),
    updatedAt:   v.string(),
  })
    .index("by_club",             ["clubId"])
    .index("by_club_and_category",["clubId", "categoryId"])
    .index("by_location",         ["locationId"]),

  posSales: defineTable({
    clubId:          v.id("clubs"),
    memberId:        v.optional(v.string()),            // Clerk userId if sold to a member
    clubMemberId:    v.optional(v.id("clubMembers")),   // linked member record (for account charges)
    memberName:      v.optional(v.string()),
    items: v.array(v.object({
      productId:      v.optional(v.id("posProducts")),
      productName:    v.string(),                       // denormalised in case product deleted
      quantity:       v.number(),
      unitPricePence: v.number(),
      subtotalPence:  v.number(),
    })),
    subtotalPence:   v.number(),                        // sum of line items
    totalPence:      v.number(),                        // subtotal (no tax split yet)
    currency:        v.string(),
    // 'cash' | 'card' | 'account' | 'terminal' | 'complimentary'
    paymentMethod:   v.string(),
    paymentIntentId: v.optional(v.id("paymentIntents")),// set when terminal payment
    notes:           v.optional(v.string()),
    voidedAt:        v.optional(v.string()),
    servedBy:        v.string(),                        // userId
    // Shift & location context — populated for all new sales
    shiftId:         v.optional(v.id("posShifts")),    // which shift this sale belongs to
    locationId:      v.optional(v.id("posLocations")), // which location (bar / pro shop)
    isGuest:         v.optional(v.boolean()),           // true = visitor / non-member sale
    createdAt:       v.string(),
  })
    .index("by_club",         ["clubId"])
    .index("by_club_and_date",["clubId", "createdAt"])
    .index("by_club_member",  ["clubMemberId"])
    .index("by_shift",        ["shiftId"]),

  // ============================================================================
  // Payment Intents — provider-agnostic record of each payment (Dojo, Square, …)
  // ============================================================================

  paymentIntents: defineTable({
    clubId: v.id("clubs"),
    clubMemberId: v.optional(v.id("clubMembers")),
    provider: v.string(),               // 'dojo' | 'square'
    providerIntentId: v.string(),       // provider's own ID
    amount: v.number(),                 // pence
    currency: v.string(),
    purpose: v.string(),                // 'topup' | 'pos_sale' | 'green_fee' | 'competition' | 'tee_time'
    status: v.string(),                 // 'pending' | 'captured' | 'failed' | 'refunded' | 'cancelled'
    terminalId: v.optional(v.string()), // set when sent to a physical terminal
    checkoutUrl: v.optional(v.string()), // hosted checkout URL (online top-up)
    saleId: v.optional(v.id("posSales")),
    description: v.optional(v.string()),
    createdAt: v.string(),
    completedAt: v.optional(v.string()),
  })
    .index("by_club", ["clubId"])
    .index("by_club_member", ["clubMemberId"])
    .index("by_provider_intent", ["provider", "providerIntentId"])
    .index("by_status", ["status"]),

  // ============================================================================
  // POS Terminals — registered payment terminals per club
  // ============================================================================

  posTerminals: defineTable({
    clubId: v.id("clubs"),
    provider: v.string(),               // 'dojo' | 'square'
    terminalId: v.string(),             // provider's terminal / device ID
    name: v.string(),                   // "Bar", "Pro Shop", "Reception"
    isActive: v.boolean(),
    createdAt: v.string(),
  })
    .index("by_club", ["clubId"]),
});
