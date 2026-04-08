import { v } from "convex/values";
import { defineSchema, defineTable } from "convex/server";

export default defineSchema({
  // ============================================================================
  // Clubs & Membership
  // ============================================================================

  clubs: defineTable({
    name: v.string(),
    slug: v.string(),           // URL-safe identifier e.g. "royal-troon-gc"
    clerkOrgId: v.optional(v.string()),
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
    // Timestamps
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_clerk_org", ["clerkOrgId"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  // Club members — one row per (club, user) pair
  // Accumulates stats across all competitions at this club
  clubMembers: defineTable({
    clubId: v.id("clubs"),
    userId: v.string(),         // Clerk user ID
    role: v.string(),           // 'admin' | 'member'
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    // Cumulative stats — updated whenever a competition resolves
    totalEntered: v.number(),   // number of competitions entered
    totalSpent: v.number(),     // total entry fees paid (pence/cents)
    totalWon: v.number(),       // total prize money received (pence/cents)
    totalProfit: v.number(),    // totalWon - totalSpent (can be negative)
    bestFinish: v.optional(v.number()), // best leaderboard position (1 = winner)
    // Timestamps
    joinedAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_club", ["clubId"])
    .index("by_club_and_user", ["clubId", "userId"])
    .index("by_user", ["userId"])
    .index("by_club_total_won", ["clubId", "totalWon"]),

  // ============================================================================
  // Competitions
  // ============================================================================

  competitions: defineTable({
    clubId: v.id("clubs"),
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
    drawType: v.string(),       // 'tiered' | 'random' | 'draft'
    tierCount: v.number(),      // how many tiers (usually 3)
    playersPerTier: v.number(), // how many players each entrant draws per tier
    // Financials
    entryFee: v.number(),       // in pence/cents
    currency: v.string(),
    prizeStructure: v.array(v.object({
      position: v.number(),
      percentage: v.number(),   // e.g. 55 for 55%
    })),
    // Metadata
    drawCompletedAt: v.optional(v.string()),
    createdBy: v.string(),      // Clerk user ID
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_club", ["clubId"])
    .index("by_club_and_slug", ["clubId", "slug"])
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
    // External IDs for score feed matching
    espnPlayerId: v.optional(v.string()),
  })
    .index("by_competition", ["competitionId"])
    .index("by_competition_and_tier", ["competitionId", "tier"]),

  // ============================================================================
  // Entries
  // ============================================================================

  entries: defineTable({
    competitionId: v.id("competitions"),
    clubId: v.id("clubs"),
    userId: v.string(),         // Clerk user ID
    displayName: v.string(),
    // Payment
    paidAt: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeCheckoutSessionId: v.optional(v.string()),
    // Drawn players — populated after draw ceremony
    drawnPlayerIds: v.optional(v.array(v.id("players"))), // one per tier
    // Computed standings — updated as scores come in
    bestPlayerScore: v.optional(v.number()), // scoreToPar of their best player
    bestPlayerPosition: v.optional(v.number()),
    leaderboardPosition: v.optional(v.number()),
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
  // Side Bets (optional pots within a competition)
  // ============================================================================

  sideBets: defineTable({
    competitionId: v.id("competitions"),
    clubId: v.id("clubs"),
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
  // Webhook idempotency (kept from health-platform)
  // ============================================================================

  webhookEvents: defineTable({
    eventId: v.string(),
    source: v.string(),         // 'stripe' | 'clerk'
    processedAt: v.string(),
  })
    .index("by_event_id", ["eventId"]),
});
