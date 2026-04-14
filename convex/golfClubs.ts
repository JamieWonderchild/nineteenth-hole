import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// ── Queries ───────────────────────────────────────────────────────────────────

export const search = query({
  args: {
    term: v.string(),
    county: v.optional(v.string()),
  },
  handler: async (ctx, { term, county }) => {
    const lower = term.toLowerCase().trim();
    if (!lower) return [];

    let clubs;
    if (county) {
      clubs = await ctx.db
        .query("golfClubs")
        .withIndex("by_county", q => q.eq("county", county))
        .collect();
    } else {
      clubs = await ctx.db.query("golfClubs").collect();
    }

    return clubs
      .filter(c => c.name.toLowerCase().includes(lower))
      .slice(0, 12);
  },
});

export const listByCounty = query({
  args: { county: v.string() },
  handler: async (ctx, { county }) => {
    return ctx.db
      .query("golfClubs")
      .withIndex("by_county", q => q.eq("county", county))
      .collect();
  },
});

export const listCounties = query({
  args: {},
  handler: async (ctx) => {
    const clubs = await ctx.db.query("golfClubs").collect();
    const counties = [...new Set(clubs.map(c => c.county))].sort();
    return counties;
  },
});

export const get = query({
  args: { golfClubId: v.id("golfClubs") },
  handler: async (ctx, { golfClubId }) => ctx.db.get(golfClubId),
});

// ── Seed ─────────────────────────────────────────────────────────────────────

const MIDDLESEX_CLUBS = [
  { name: "Finchley Golf Club", county: "Middlesex", postcode: "N3 3JH", englandGolfId: "29000" },
  { name: "Enfield Golf Club", county: "Middlesex", postcode: "EN2 7DA", englandGolfId: "29001" },
  { name: "North Middlesex Golf Club", county: "Middlesex", postcode: "N20 8EZ" },
  { name: "Muswell Hill Golf Club", county: "Middlesex", postcode: "N10 3JX" },
  { name: "Hampstead Golf Club", county: "Middlesex", postcode: "NW7 1RU" },
  { name: "Hendon Golf Club", county: "Middlesex", postcode: "NW4 3JT" },
  { name: "Mill Hill Golf Club", county: "Middlesex", postcode: "NW7 4AL" },
  { name: "Highgate Golf Club", county: "Middlesex", postcode: "N6 4AH" },
  { name: "Crews Hill Golf Club", county: "Middlesex", postcode: "EN2 8AZ" },
  { name: "Bush Hill Park Golf Club", county: "Middlesex", postcode: "EN1 2BW" },
  { name: "West Middlesex Golf Club", county: "Middlesex", postcode: "TW7 5LR" },
  { name: "Pinner Hill Golf Club", county: "Middlesex", postcode: "HA5 3YA" },
  { name: "Ruislip Golf Club", county: "Middlesex", postcode: "HA4 7DQ" },
  { name: "Hillingdon Golf Club", county: "Middlesex", postcode: "UB10 0JQ" },
  { name: "Ealing Golf Club", county: "Middlesex", postcode: "W5 2HL" },
  { name: "Trent Park Golf Club", county: "Middlesex", postcode: "EN4 0PS" },
  { name: "Whitewebbs Golf Club", county: "Middlesex", postcode: "EN2 9HH" },
  { name: "Grims Dyke Golf Club", county: "Middlesex", postcode: "HA3 6ST" },
  { name: "Sudbury Golf Club", county: "Middlesex", postcode: "HA1 3RT" },
  { name: "Perivale Park Golf Club", county: "Middlesex", postcode: "UB6 8TL" },
  { name: "Arkley Golf Club", county: "Middlesex", postcode: "EN5 3HA" },
  { name: "Hadley Wood Golf Club", county: "Middlesex", postcode: "EN4 0JJ" },
  { name: "Hartsbourne Golf & Country Club", county: "Middlesex", postcode: "WD23 1JW" },
  { name: "Wembley Golf Club", county: "Middlesex", postcode: "HA9 6QH" },
  { name: "Horsenden Hill Golf Club", county: "Middlesex", postcode: "UB6 7PQ" },
];

const SURREY_CLUBS = [
  { name: "Royal Mid-Surrey Golf Club", county: "Surrey", postcode: "TW9 2SB" },
  { name: "Richmond Golf Club", county: "Surrey", postcode: "TW10 7AS" },
  { name: "Roehampton Club", county: "Surrey", postcode: "SW15 5LR" },
  { name: "Strawberry Hill Golf Club", county: "Surrey", postcode: "TW2 5SD" },
  { name: "Sunningdale Golf Club", county: "Surrey", postcode: "SL5 9RR" },
  { name: "Wentworth Club", county: "Surrey", postcode: "GU25 4LS" },
  { name: "Woking Golf Club", county: "Surrey", postcode: "GU22 0JZ" },
  { name: "Guildford Golf Club", county: "Surrey", postcode: "GU1 2HJ" },
];

const HERTFORDSHIRE_CLUBS = [
  { name: "Porters Park Golf Club", county: "Hertfordshire", postcode: "WD7 9JR" },
  { name: "Radlett Park Golf Club", county: "Hertfordshire", postcode: "WD7 8JZ" },
  { name: "South Herts Golf Club", county: "Hertfordshire", postcode: "N20 8QU" },
  { name: "Verulam Golf Club", county: "Hertfordshire", postcode: "AL1 1JG" },
  { name: "Welwyn Garden City Golf Club", county: "Hertfordshire", postcode: "AL8 7BP" },
  { name: "Harpenden Golf Club", county: "Hertfordshire", postcode: "AL5 1BL" },
  { name: "Mid Herts Golf Club", county: "Hertfordshire", postcode: "AL4 8RS" },
  { name: "Brocket Hall Golf Club", county: "Hertfordshire", postcode: "AL8 7XG" },
];

const ALL_SEED_CLUBS = [
  ...MIDDLESEX_CLUBS,
  ...SURREY_CLUBS,
  ...HERTFORDSHIRE_CLUBS,
];

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const emails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    if (!identity?.email || !emails.includes(identity.email)) throw new Error("Super admin only");

    // Idempotent — skip if already seeded
    const existing = await ctx.db.query("golfClubs").collect();
    if (existing.length > 0) return { skipped: true, count: existing.length };

    for (const club of ALL_SEED_CLUBS) {
      await ctx.db.insert("golfClubs", club);
    }

    return { seeded: true, count: ALL_SEED_CLUBS.length };
  },
});

// Add a new club to the directory (any club admin — used when opponent isn't seeded)
export const create = mutation({
  args: {
    name: v.string(),
    county: v.string(),
    postcode: v.optional(v.string()),
    website: v.optional(v.string()),
    englandGolfId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    // Deduplicate by name + county
    const existing = await ctx.db
      .query("golfClubs")
      .withIndex("by_county", q => q.eq("county", args.county))
      .collect();
    const dupe = existing.find(c => c.name.toLowerCase() === args.name.toLowerCase().trim());
    if (dupe) return dupe._id;
    return ctx.db.insert("golfClubs", { ...args, name: args.name.trim() });
  },
});

// Link a platform club to its directory entry
export const linkToPlatformClub = mutation({
  args: {
    golfClubId: v.id("golfClubs"),
    platformClubId: v.id("clubs"),
  },
  handler: async (ctx, { golfClubId, platformClubId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await ctx.db.patch(golfClubId, { platformClubId });
  },
});
