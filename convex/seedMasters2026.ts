import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * One-time seed for the completed Masters 2026 Finchley sweepstake.
 * Run once via: npx convex run seedMasters2026:seedMasters2026Finchley
 *
 * Rules: pick 5 golfers + 1 reserve. Highest combined prize money wins.
 * Reserve activates only if two entries share identical 5 picks.
 * £20 per team, winner takes all (£420 pot — 21 teams).
 *
 * Results sourced from Golfweek / Masters 2026 final leaderboard.
 */
export const seedMasters2026Finchley = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotency check
    const existing = await ctx.db
      .query("competitions")
      .withIndex("by_slug", q => q.eq("slug", "masters-2026-finchley"))
      .collect();
    if (existing.length > 0) {
      return { skipped: true, competitionId: existing[0]._id };
    }

    const now = new Date().toISOString();
    const paidAt = "2026-04-10T07:30:00.000Z";

    // ── Competition ──────────────────────────────────────────────────────────
    const competitionId = await ctx.db.insert("competitions", {
      scope: "platform",
      name: "Masters 2026 — Finchley Sweepstake",
      slug: "masters-2026-finchley",
      description:
        "Finchley members picked 5 golfers each. Highest combined prize money takes the pot. £20 per team.",
      type: "major",
      tournamentRef: "masters-2026",
      status: "complete",
      startDate: "2026-04-10",
      endDate: "2026-04-13",
      entryDeadline: "2026-04-10T08:00:00.000Z",
      drawType: "pick",
      tierCount: 0,
      playersPerTier: 0,
      pickCount: 5,
      reserveCount: 1,
      entryFee: 2000,        // £20 in pence
      currency: "GBP",
      prizeStructure: [{ position: 1, percentage: 100 }],
      paymentCollection: "cash",
      drawCompletedAt: paidAt,
      createdBy: "seed",
      createdAt: paidAt,
      updatedAt: now,
    });

    // ── Players ──────────────────────────────────────────────────────────────
    // prizeMoney stored in USD cents (consistent with ESPN sync)
    // Source: Golfweek / Masters 2026 official prize money
    const playerRows: Array<{ name: string; prizeMoney: number; madeCut: boolean }> = [
      { name: "Rory McIlroy",      prizeMoney: 450000000, madeCut: true  },  // 1st   $4,500,000
      { name: "Scottie Scheffler", prizeMoney: 243000000, madeCut: true  },  // 2nd   $2,430,000
      { name: "Tyrrell Hatton",    prizeMoney: 108000000, madeCut: true  },  // T3    $1,080,000
      { name: "Justin Rose",       prizeMoney: 108000000, madeCut: true  },  // T3    $1,080,000
      { name: "Cameron Young",     prizeMoney: 108000000, madeCut: true  },  // T3    $1,080,000
      { name: "Collin Morikawa",   prizeMoney:  72562500, madeCut: true  },  // T7    $725,625
      { name: "Xander Schauffele", prizeMoney:  63000000, madeCut: true  },  // T9    $630,000
      { name: "Jordan Spieth",     prizeMoney:  42750000, madeCut: true  },  // T12   $427,500
      { name: "Hideki Matsuyama",  prizeMoney:  42750000, madeCut: true  },  // T12   $427,500
      { name: "Patrick Reed",      prizeMoney:  42750000, madeCut: true  },  // T12   $427,500
      { name: "Brooks Koepka",     prizeMoney:  42750000, madeCut: true  },  // T12   $427,500
      { name: "Matt Fitzpatrick",  prizeMoney:  31500000, madeCut: true  },  // T18   $315,000
      { name: "Ludvig Aberg",      prizeMoney:  25200000, madeCut: true  },  // T21   $252,000
      { name: "Adam Scott",        prizeMoney:  17807100, madeCut: true  },  // T24   $178,071
      { name: "Tommy Fleetwood",   prizeMoney:  12150000, madeCut: true  },  // T33   $121,500
      { name: "Jon Rahm",          prizeMoney:  10125000, madeCut: true  },  // T38   $101,250
      { name: "Aaron Rai",         prizeMoney:   6165000, madeCut: true  },  // 48    $61,650
      { name: "Corey Conners",     prizeMoney:   5760000, madeCut: true  },  // T49   $57,600
      // Missed cut — $0
      { name: "Bryson DeChambeau", prizeMoney:         0, madeCut: false },
      { name: "Robert MacIntyre",  prizeMoney:         0, madeCut: false },
      { name: "Min Woo Lee",       prizeMoney:         0, madeCut: false },
      { name: "Sahith Bhatia",     prizeMoney:         0, madeCut: false },
    ];

    const pid: Record<string, Id<"players">> = {};
    for (const row of playerRows) {
      pid[row.name] = await ctx.db.insert("players", {
        competitionId,
        name: row.name,
        tier: 1,
        prizeMoney: row.prizeMoney,
        madeCut: row.madeCut,
      });
    }

    // Shorthand aliases
    const R   = pid["Rory McIlroy"];
    const S   = pid["Scottie Scheffler"];
    const TH  = pid["Tyrrell Hatton"];
    const JR  = pid["Justin Rose"];
    const CY  = pid["Cameron Young"];
    const CM  = pid["Collin Morikawa"];
    const XS  = pid["Xander Schauffele"];
    const JS  = pid["Jordan Spieth"];
    const HM  = pid["Hideki Matsuyama"];
    const PR  = pid["Patrick Reed"];
    // const BK  = pid["Brooks Koepka"];   — only used as reserve (Chris)
    const MF  = pid["Matt Fitzpatrick"];
    const LA  = pid["Ludvig Aberg"];
    const AS  = pid["Adam Scott"];
    const TF  = pid["Tommy Fleetwood"];
    const JoR = pid["Jon Rahm"];
    const AR  = pid["Aaron Rai"];
    const CC  = pid["Corey Conners"];
    const BD  = pid["Bryson DeChambeau"];
    const RM  = pid["Robert MacIntyre"];
    const MWL = pid["Min Woo Lee"];
    const SB  = pid["Sahith Bhatia"];
    const BK  = pid["Brooks Koepka"];

    // Pot = 21 entries × £20 = £420 = 42000p
    const POT = 42000;

    // ── Entries ──────────────────────────────────────────────────────────────
    // Sorted by totalPrizeMoney descending (leaderboard position 1–21).
    // totalPrizeMoney = sum of 5 picks' prizeMoney (USD cents).
    // Reserve only activates if two entries have identical pick sets — none here.
    //
    // Leaderboard:
    //  1. Ed          $9,067,500  Scottie + Rory + Rose + Reed + Xander
    //  2. Bliss        $8,577,000  Rory + Fitz + Rose + Scottie + Aberg
    //  3. Tom G        $8,426,250  Scottie + Rahm + Rory + Cam Young + Fitz
    //  4. Lewis        $8,262,000  Scottie + Aberg + Cam Young + Rory + Min Woo Lee
    //  5. Dan Berman   $7,357,500  Scottie + Bryson + Rory + Bob Mc + Reed
    //  6. Andy Rose    $7,346,250  Rahm + Fitz + Rory + Scottie + Bryson
    //  7. Bobby        $7,283,250  Scottie + Rahm + Bryson + Rory + Aberg
    //  8. Jez          $7,033,500  Rory + Tommy + Rose + Cam Young + Aberg
    //  9. Chris        $5,953,500  Rory + Aberg + Rose + Bob Mc + Tommy
    // 10. Gerry        $5,802,750  Rory + Rahm + Bryson + Rose + Tommy
    // 11. Gerry        $5,343,750  Rory + Rahm + Bryson + Fitz + Reed
    // 12. Ten Pint     $3,631,500  Min Woo Lee + Bryson + Cam Young + Scottie + Tommy
    // 13. Scott J      $3,534,750  Scottie + Rahm + Xander + Tommy + Aberg
    // 14. Harley       $3,525,750  Scottie + Aberg + Rahm + Reed + Fitz
    // 15. Scott J      $2,958,750  Scottie + Bryson + Rahm + Reed + Bob Mc
    // 16. Scott J      $2,915,100  Scottie + Bhatia + Conners + Matsuyama + Bob Mc
    // 17. AJ           $2,783,250  Rahm + Bryson + Bob Mc + Scottie + Aberg
    // 18. Bobby        $2,596,500  Tommy + Fitz + Rose + Hatton + Bhatia
    // 19. Orovan       $2,360,250  Rahm + Spieth + Rose + Tommy + Xander
    // 20. Lewis        $1,617,750  Rahm + Fitz + Tommy + Bryson + Rose
    // 21. Andy Rose    $1,167,750  Rahm + Bryson + Fitz + Xander + Tommy
    const entryDefs: Array<{
      displayName: string;
      userId: string;
      picks: Id<"players">[];
      reserve: Id<"players">[];
      total: number;
      position: number;
      prizeWon?: number;
    }> = [
      {
        displayName: "Ed",
        userId: "finchley_masters_ed",
        picks:   [S,   R,   JR,  PR,  XS],
        reserve: [CY],
        total: 906750000,
        position: 1,
        prizeWon: POT,
      },
      {
        displayName: "Bliss",
        userId: "finchley_masters_bliss",
        picks:   [R,   MF,  JR,  S,   LA],
        reserve: [BD],
        total: 857700000,
        position: 2,
      },
      {
        displayName: "Tom G",
        userId: "finchley_masters_tomg",
        picks:   [S,   JoR, R,   CY,  MF],
        reserve: [XS],
        total: 842625000,
        position: 3,
      },
      {
        displayName: "Lewis",
        userId: "finchley_masters_lewis_2",
        picks:   [S,   LA,  CY,  R,   MWL],
        reserve: [XS],
        total: 826200000,
        position: 4,
      },
      {
        displayName: "Dan Berman",
        userId: "finchley_masters_danberman",
        picks:   [S,   BD,  R,   RM,  PR],
        reserve: [LA],
        total: 735750000,
        position: 5,
      },
      {
        displayName: "Andy Rose",
        userId: "finchley_masters_andyrose_1",
        picks:   [JoR, MF,  R,   S,   BD],
        reserve: [LA],
        total: 734625000,
        position: 6,
      },
      {
        displayName: "Bobby",
        userId: "finchley_masters_bobby_1",
        picks:   [S,   JoR, BD,  R,   LA],
        reserve: [XS],
        total: 728325000,
        position: 7,
      },
      {
        displayName: "Jez",
        userId: "finchley_masters_jez",
        picks:   [R,   TF,  JR,  CY,  LA],
        reserve: [S],
        total: 703350000,
        position: 8,
      },
      {
        displayName: "Chris",
        userId: "finchley_masters_chris",
        picks:   [R,   LA,  JR,  RM,  TF],
        reserve: [BK],
        total: 595350000,
        position: 9,
      },
      {
        displayName: "Gerry",
        userId: "finchley_masters_gerry_2",
        picks:   [R,   JoR, BD,  JR,  TF],
        reserve: [MF],
        total: 580275000,
        position: 10,
      },
      {
        displayName: "Gerry",
        userId: "finchley_masters_gerry_1",
        picks:   [R,   JoR, BD,  MF,  PR],
        reserve: [JR],
        total: 534375000,
        position: 11,
      },
      {
        displayName: "Ten Pint",
        userId: "finchley_masters_tenpint",
        picks:   [MWL, BD,  CY,  S,   TF],
        reserve: [CM],
        total: 363150000,
        position: 12,
      },
      {
        displayName: "Scott J",
        userId: "finchley_masters_scottj_3",
        picks:   [S,   JoR, XS,  TF,  LA],
        reserve: [AS],
        total: 353475000,
        position: 13,
      },
      {
        displayName: "Harley",
        userId: "finchley_masters_harley",
        picks:   [S,   LA,  JoR, PR,  MF],
        reserve: [XS],
        total: 352575000,
        position: 14,
      },
      {
        displayName: "Scott J",
        userId: "finchley_masters_scottj_1",
        picks:   [S,   BD,  JoR, PR,  RM],
        reserve: [AS],
        total: 295875000,
        position: 15,
      },
      {
        displayName: "Scott J",
        userId: "finchley_masters_scottj_2",
        picks:   [S,   SB,  CC,  HM,  RM],
        reserve: [AS],
        total: 291510000,
        position: 16,
      },
      {
        displayName: "AJ",
        userId: "finchley_masters_aj",
        picks:   [JoR, BD,  RM,  S,   LA],
        reserve: [CM],
        total: 278325000,
        position: 17,
      },
      {
        displayName: "Bobby",
        userId: "finchley_masters_bobby_2",
        picks:   [TF,  MF,  JR,  TH,  SB],
        reserve: [AR],
        total: 259650000,
        position: 18,
      },
      {
        displayName: "Orovan",
        userId: "finchley_masters_orovan",
        picks:   [JoR, JS,  JR,  TF,  XS],
        reserve: [LA],
        total: 236025000,
        position: 19,
      },
      {
        displayName: "Lewis",
        userId: "finchley_masters_lewis_1",
        picks:   [JoR, MF,  TF,  BD,  JR],
        reserve: [CC],
        total: 161775000,
        position: 20,
      },
      {
        displayName: "Andy Rose",
        userId: "finchley_masters_andyrose_2",
        picks:   [JoR, BD,  MF,  XS,  TF],
        reserve: [R],
        total: 116775000,
        position: 21,
      },
    ];

    for (const e of entryDefs) {
      await ctx.db.insert("entries", {
        competitionId,
        userId: e.userId,
        displayName: e.displayName,
        drawnPlayerIds: e.picks,
        reservePlayerIds: e.reserve,
        totalPrizeMoney: e.total,
        leaderboardPosition: e.position,
        paidAt,
        ...(e.prizeWon !== undefined && { prizeWon: e.prizeWon }),
        createdAt: paidAt,
        updatedAt: now,
      });
    }

    return { competitionId, entriesSeeded: entryDefs.length };
  },
});
