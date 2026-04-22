import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSuperAdmin(email?: string | null): boolean {
  const emails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  return !!(email && emails.includes(email));
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const search = query({
  args: {
    query: v.string(),
    country: v.optional(v.string()),
    county: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { query: q, country, county, limit }) => {
    if (!q.trim()) return [];
    return ctx.db
      .query("golfCourses")
      .withSearchIndex("search_name", s => {
        let search = s.search("name", q);
        if (country) search = search.eq("country", country);
        if (county) search = search.eq("county", county);
        return search;
      })
      .take(limit ?? 20);
  },
});

export const get = query({
  args: { courseId: v.id("golfCourses") },
  handler: async (ctx, { courseId }) => ctx.db.get(courseId),
});

export const getWithTees = query({
  args: { courseId: v.id("golfCourses") },
  handler: async (ctx, { courseId }) => {
    const course = await ctx.db.get(courseId);
    if (!course) return null;
    const tees = await ctx.db
      .query("courseTees")
      .withIndex("by_course", q => q.eq("courseId", courseId))
      .collect();

    // If a club has manually entered a Course Card linked to this global entry,
    // use those holes (correct per-hole par + SI) in preference to the API data.
    const clubCourse = await ctx.db
      .query("courses")
      .withIndex("by_golf_course", q => q.eq("golfCourseId", courseId))
      .first();

    return {
      ...course,
      tees,
      clubCourseHoles: clubCourse?.holes ?? null,
    };
  },
});

export const listTees = query({
  args: { courseId: v.id("golfCourses") },
  handler: async (ctx, { courseId }) =>
    ctx.db
      .query("courseTees")
      .withIndex("by_course", q => q.eq("courseId", courseId))
      .collect(),
});

export const getTee = query({
  args: { teeId: v.id("courseTees") },
  handler: async (ctx, { teeId }) => ctx.db.get(teeId),
});

export const listByCountry = query({
  args: { country: v.string() },
  handler: async (ctx, { country }) =>
    ctx.db
      .query("golfCourses")
      .withIndex("by_country", q => q.eq("country", country))
      .collect(),
});

export const listByCounty = query({
  args: { county: v.string(), country: v.optional(v.string()) },
  handler: async (ctx, { county, country }) =>
    ctx.db
      .query("golfCourses")
      .withIndex("by_county", q => q.eq("county", county))
      .filter(q => country ? q.eq(q.field("country"), country) : q.eq(q.field("country"), q.field("country")))
      .collect(),
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const course = await ctx.db
      .query("golfCourses")
      .withIndex("by_slug", q => q.eq("slug", slug))
      .first();
    if (!course) return null;
    const tees = await ctx.db
      .query("courseTees")
      .withIndex("by_course", q => q.eq("courseId", course._id))
      .collect();
    return { ...course, tees };
  },
});

// Courses within ~radiusMiles of a lat/lng (bounding box approximation).
export const listNearby = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    radiusMiles: v.optional(v.number()),
    limit: v.optional(v.number()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, { latitude, longitude, radiusMiles = 25, limit = 20, country }) => {
    const latDelta = radiusMiles / 69;
    const lngDelta = radiusMiles / (69 * Math.cos((latitude * Math.PI) / 180));
    // If country is provided use the index; otherwise scan all (less efficient but global)
    const base = country
      ? ctx.db.query("golfCourses").withIndex("by_country", q => q.eq("country", country))
      : ctx.db.query("golfCourses");
    return base
      .filter(q =>
        q.and(
          q.gte(q.field("latitude"), latitude - latDelta),
          q.lte(q.field("latitude"), latitude + latDelta),
          q.gte(q.field("longitude"), longitude - lngDelta),
          q.lte(q.field("longitude"), longitude + lngDelta)
        )
      )
      .take(limit);
  },
});

// Courses the user has played recently (distinct, most recent first).
export const listRecentByUser = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit = 5 }) => {
    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_user_and_date", q => q.eq("userId", userId))
      .order("desc")
      .filter(q => q.neq(q.field("golfCourseId"), undefined))
      .take(50);

    const seen = new Set<string>();
    const courseIds: string[] = [];
    for (const r of rounds) {
      if (r.golfCourseId && !seen.has(r.golfCourseId)) {
        seen.add(r.golfCourseId);
        courseIds.push(r.golfCourseId);
        if (courseIds.length >= limit) break;
      }
    }
    return Promise.all(courseIds.map(id => ctx.db.get(id as any)));
  },
});

// Rounds played at a specific course by a user.
export const listRoundsForCourse = query({
  args: { userId: v.string(), courseId: v.id("golfCourses") },
  handler: async (ctx, { userId, courseId }) =>
    ctx.db
      .query("rounds")
      .withIndex("by_user_and_date", q => q.eq("userId", userId))
      .order("desc")
      .filter(q => q.eq(q.field("golfCourseId"), courseId))
      .collect(),
});

// ── Mutations (super admin only) ──────────────────────────────────────────────

const courseFields = {
  name: v.string(),
  venueName: v.optional(v.string()),
  slug: v.string(),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  address: v.optional(v.string()),
  city: v.optional(v.string()),
  county: v.optional(v.string()),
  country: v.string(),
  postcode: v.optional(v.string()),
  timezone: v.optional(v.string()),
  numberOfHoles: v.number(),
  par: v.optional(v.number()),
  courseType: v.optional(v.string()),
  website: v.optional(v.string()),
  phone: v.optional(v.string()),
  golfClubId: v.optional(v.id("golfClubs")),
  platformClubId: v.optional(v.id("clubs")),
  golfApiUkId: v.optional(v.string()),
  golfCourseApiId: v.optional(v.string()),
  osmRelationId: v.optional(v.string()),
  englandGolfCourseId: v.optional(v.string()),
  hnaClubId: v.optional(v.string()),
  dataSource: v.string(),
};

const teeHoleFields = v.object({
  number: v.number(),
  par: v.number(),
  strokeIndex: v.number(),
  yards: v.optional(v.number()),
  meters: v.optional(v.number()),
  teeLatitude: v.optional(v.number()),
  teeLongitude: v.optional(v.number()),
  greenLatitude: v.optional(v.number()),
  greenLongitude: v.optional(v.number()),
});

const teeFields = {
  courseId: v.id("golfCourses"),
  name: v.string(),
  colour: v.string(),
  gender: v.string(),
  courseRating: v.optional(v.number()),
  slopeRating: v.optional(v.number()),
  par: v.number(),
  totalYards: v.optional(v.number()),
  totalMeters: v.optional(v.number()),
  holes: v.array(teeHoleFields),
  dataSource: v.optional(v.string()),
};

export const upsert = mutation({
  args: { courseId: v.optional(v.id("golfCourses")), ...courseFields },
  handler: async (ctx, { courseId, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !isSuperAdmin(identity.email)) throw new Error("Super admin only");
    const now = new Date().toISOString();
    if (courseId) {
      await ctx.db.patch(courseId, { ...fields, updatedAt: now });
      return courseId;
    }
    return ctx.db.insert("golfCourses", { ...fields, createdAt: now, updatedAt: now });
  },
});

export const upsertTee = mutation({
  args: { teeId: v.optional(v.id("courseTees")), ...teeFields },
  handler: async (ctx, { teeId, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !isSuperAdmin(identity.email)) throw new Error("Super admin only");
    const now = new Date().toISOString();
    if (teeId) {
      await ctx.db.patch(teeId, { ...fields, updatedAt: now });
      return teeId;
    }
    return ctx.db.insert("courseTees", { ...fields, createdAt: now, updatedAt: now });
  },
});

export const verify = mutation({
  args: { courseId: v.id("golfCourses") },
  handler: async (ctx, { courseId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !isSuperAdmin(identity.email)) throw new Error("Super admin only");
    await ctx.db.patch(courseId, {
      verified: true,
      verifiedAt: new Date().toISOString(),
      verifiedBy: identity.subject,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Internal versions — used by import actions (no auth check)
export const internalUpsert = internalMutation({
  args: { courseId: v.optional(v.id("golfCourses")), ...courseFields },
  handler: async (ctx, { courseId, ...fields }) => {
    const now = new Date().toISOString();
    if (courseId) {
      await ctx.db.patch(courseId, { ...fields, updatedAt: now });
      return courseId;
    }
    // Deduplicate by golfApiUkId if provided
    if (fields.golfApiUkId) {
      const existing = await ctx.db
        .query("golfCourses")
        .withIndex("by_golf_api_uk_id", q => q.eq("golfApiUkId", fields.golfApiUkId!))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { ...fields, updatedAt: now });
        return existing._id;
      }
    }
    // Deduplicate by golfCourseApiId if provided
    if (fields.golfCourseApiId) {
      const existing = await ctx.db
        .query("golfCourses")
        .withIndex("by_golf_course_api_id", q => q.eq("golfCourseApiId", fields.golfCourseApiId!))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { ...fields, updatedAt: now });
        return existing._id;
      }
    }
    // Deduplicate by hnaClubId if provided
    if (fields.hnaClubId) {
      const existing = await ctx.db
        .query("golfCourses")
        .withIndex("by_hna_club_id", q => q.eq("hnaClubId", fields.hnaClubId!))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { ...fields, updatedAt: now });
        return existing._id;
      }
    }
    return ctx.db.insert("golfCourses", { ...fields, createdAt: now, updatedAt: now });
  },
});

export const internalUpsertTee = internalMutation({
  args: { teeId: v.optional(v.id("courseTees")), ...teeFields },
  handler: async (ctx, { teeId, ...fields }) => {
    const now = new Date().toISOString();
    if (teeId) {
      await ctx.db.patch(teeId, { ...fields, updatedAt: now });
      return teeId;
    }
    // Deduplicate by courseId + colour + gender
    const existing = await ctx.db
      .query("courseTees")
      .withIndex("by_course_and_gender", q =>
        q.eq("courseId", fields.courseId).eq("gender", fields.gender)
      )
      .filter(q => q.eq(q.field("colour"), fields.colour))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("courseTees", { ...fields, createdAt: now, updatedAt: now });
  },
});

export const internalDelete = internalMutation({
  args: { id: v.id("golfCourses") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});

export const internalDeleteTee = internalMutation({
  args: { id: v.id("courseTees") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});

// Delete all golfCourses + courseTees rows for a given country code.
// Internal — run via CLI: npx convex run golfCourses:deleteByCountry '{"country":"ZAF"}'
export const deleteByCountry = internalAction({
  args: { country: v.string() },
  handler: async (ctx, { country }) => {
    const courses: any[] = await ctx.runQuery(api.golfCourses.listByCountry, { country });
    let deletedCourses = 0;
    let deletedTees = 0;

    for (const course of courses) {
      const tees: any[] = await ctx.runQuery(api.golfCourses.listTees, { courseId: course._id });
      for (const tee of tees) {
        await ctx.runMutation(internal.golfCourses.internalDeleteTee, { id: tee._id });
        deletedTees++;
      }
      await ctx.runMutation(internal.golfCourses.internalDelete, { id: course._id });
      deletedCourses++;
    }

    return { country, deletedCourses, deletedTees };
  },
});

export const linkToClub = mutation({
  args: {
    courseId: v.id("golfCourses"),
    platformClubId: v.optional(v.id("clubs")),
    golfClubId: v.optional(v.id("golfClubs")),
  },
  handler: async (ctx, { courseId, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !isSuperAdmin(identity.email)) throw new Error("Super admin only");
    await ctx.db.patch(courseId, { ...fields, updatedAt: new Date().toISOString() });
  },
});

// ── Import action: UK Golf Course Data API (via RapidAPI) ─────────────────────
//
// API: uk-golf-course-data-api.p.rapidapi.com
// Auth: GOLF_API_UK_KEY env var (RapidAPI key) — set in Convex dashboard
// Free tier: 200 requests/month, 5 req/min
//
// RATE BUDGET — be careful:
//   importPage:  1 request  → imports basic data for 20 clubs (no tees)
//   importDetail: 1 request → imports full data for 1 club (including tees + CR/slope)
//
// Recommended workflow:
//   1. importDetail({ clubId }) for specific clubs
//   2. importPage({ page: 1, county: "Middlesex" }) to bulk-import a county

const RAPID_HOST = "uk-golf-course-data-api.p.rapidapi.com";
const RAPID_BASE = `https://${RAPID_HOST}`;

function rapidHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "x-rapidapi-host": RAPID_HOST,
    "x-rapidapi-key": apiKey,
  };
}

// Import full detail for a single club (1 API request).
// This is the primary import method — gets tees with CR/slope.
export const importClubDetail = action({
  args: {
    // UUID from the API (e.g. "30d22604-61f8-4597-a8db-2d4e5bd902c4")
    clubId: v.string(),
  },
  handler: async (ctx, { clubId }) => {
    const apiKey = process.env.GOLF_API_UK_KEY;
    if (!apiKey) throw new Error("GOLF_API_UK_KEY not set in Convex dashboard");

    const res = await fetch(`${RAPID_BASE}/clubs/${clubId}`, {
      headers: rapidHeaders(apiKey),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    const club: any = await res.json();

    return importClubRecord(ctx, club);
  },
});

// Import a page of clubs (1 API request → up to 20 clubs, basic data only — no tees).
// Use this to populate golfCourses with searchable names/locations cheaply.
// Then call importClubDetail for the clubs you want full tee data for.
export const importPage = action({
  args: {
    page: v.optional(v.number()),         // 1-based, default 1
    county: v.optional(v.string()),        // client-side filter (e.g. "Middlesex")
    countryCode: v.optional(v.string()),   // client-side filter (e.g. "ENG")
  },
  handler: async (ctx, { page = 1, county, countryCode }) => {
    const apiKey = process.env.GOLF_API_UK_KEY;
    if (!apiKey) throw new Error("GOLF_API_UK_KEY not set in Convex dashboard");

    const res = await fetch(
      `${RAPID_BASE}/clubs?page=${page}&per_page=20`,
      { headers: rapidHeaders(apiKey) }
    );
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    const data: any = await res.json();

    let clubs: any[] = data.clubs ?? [];

    // Client-side filters (API list endpoint doesn't filter by county/country)
    if (county) clubs = clubs.filter((c: any) =>
      c.county?.toLowerCase().includes(county.toLowerCase())
    );
    if (countryCode) clubs = clubs.filter((c: any) =>
      c.country_code === countryCode
    );

    let imported = 0;
    let skipped = 0;

    for (const club of clubs) {
      try {
        await importBasicClub(ctx, club);
        imported++;
      } catch (e) {
        console.error(`Failed to import ${club.name}:`, e);
        skipped++;
      }
    }

    return {
      imported,
      skipped,
      page,
      totalPages: data.total_pages,
      totalClubs: data.total,
      hasMore: page < data.total_pages,
    };
  },
});

// Kick off a full bulk import of all clubs (basic data only — no tees).
// Chains through all pages at 13s intervals to stay under 5 req/min.
// Super admin only. Run once from the Convex dashboard or CLI.
export const startBulkImport = action({
  args: { startPage: v.optional(v.number()) },
  handler: async (ctx, { startPage = 1 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !isSuperAdmin(identity.email)) throw new Error("Super admin only");
    await ctx.scheduler.runAfter(0, internal.golfCourses.importPageChain, { page: startPage });
    return { started: true, startPage };
  },
});

// Internal — imports one page then schedules the next.
// 13s delay between pages ≈ 4.6 req/min (under the 5/min limit).
export const importPageChain = internalAction({
  args: { page: v.number() },
  handler: async (ctx, { page }) => {
    const apiKey = process.env.GOLF_API_UK_KEY;
    if (!apiKey) throw new Error("GOLF_API_UK_KEY not set");

    const res = await fetch(`${RAPID_BASE}/clubs?page=${page}&per_page=20`, {
      headers: rapidHeaders(apiKey),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    const data: any = await res.json();

    let imported = 0;
    let skipped = 0;
    for (const club of data.clubs ?? []) {
      try {
        await importBasicClub(ctx, club);
        imported++;
      } catch (e) {
        console.error(`Page ${page} — failed to import ${club.name}:`, e);
        skipped++;
      }
    }

    console.log(`Bulk import page ${page}/${data.total_pages}: +${imported} clubs (${skipped} skipped)`);

    if (page < data.total_pages) {
      await ctx.scheduler.runAfter(13_000, internal.golfCourses.importPageChain, { page: page + 1 });
    } else {
      console.log(`Bulk import complete — all ${data.total_pages} pages processed`);
    }
  },
});

// Lazy-fetch full tee data for a course the first time a user tries to use it.
// Safe to call from the client — if tees already exist, returns immediately.
export const ensureDetail = action({
  args: { courseId: v.id("golfCourses") },
  handler: async (ctx, { courseId }) => {
    const course: any = await ctx.runQuery(api.golfCourses.get, { courseId });
    if (!course) return;

    // Already has tees — nothing to do
    const tees: any[] = await ctx.runQuery(api.golfCourses.listTees, { courseId });
    if (tees.length > 0) return;

    // No API ID — can't fetch detail
    if (!course.golfApiUkId) return;

    await ctx.runAction(api.golfCourses.importClubDetail, { clubId: course.golfApiUkId });
  },
});

// ── Internal helpers ──────────────────────────────────────────────────────────

async function importBasicClub(ctx: any, club: any) {
  const slug = makeSlug(club.name);
  await ctx.runMutation(internal.golfCourses.internalUpsert, {
    name: club.name,
    slug,
    country: club.country_code ?? "ENG",
    county: club.county ?? undefined,
    city: club.city ?? undefined,
    postcode: club.postcode ?? undefined,
    latitude: club.latitude ?? undefined,
    longitude: club.longitude ?? undefined,
    numberOfHoles: 18, // default — updated when detail is fetched
    courseType: normaliseType(club.course_type),
    golfApiUkId: String(club.id),
    dataSource: "golf_api_uk",
  });
}

async function importClubRecord(ctx: any, club: any) {
  // A club can have multiple courses (e.g. "Old Course", "New Course")
  let imported = 0;

  for (const course of club.courses ?? []) {
    const name = (club.courses.length > 1 ? course.name : club.name) || club.name;
    const slug = makeSlug(name + (club.courses.length > 1 ? `-${course.id.slice(0, 6)}` : ""));

    const address = [
      club.address?.address_line_1,
      club.address?.address_line_2,
    ].filter(Boolean).join(", ");

    const courseId: any = await ctx.runMutation(internal.golfCourses.internalUpsert, {
      name,
      venueName: club.courses.length > 1 ? club.name : undefined,
      slug,
      country: club.country_code ?? "ENG",
      county: (club.address?.county ?? club.county) ?? undefined,
      city: (club.address?.city ?? club.city) ?? undefined,
      address: address || undefined,
      postcode: (club.address?.postcode ?? club.postcode) ?? undefined,
      latitude: (club.location?.latitude ?? club.latitude) ?? undefined,
      longitude: (club.location?.longitude ?? club.longitude) ?? undefined,
      phone: club.contact?.phone ?? undefined,
      website: club.contact?.website ?? undefined,
      numberOfHoles: course.holes ?? 18,
      par: course.par ?? undefined,
      courseType: normaliseType(club.course_type),
      golfApiUkId: String(club.id),
      dataSource: "golf_api_uk",
    });

    // Import tee sets (the data we're really here for: CR + slope)
    for (const tee of course.tee_sets ?? []) {
      await ctx.runMutation(internal.golfCourses.internalUpsertTee, {
        courseId,
        name: tee.name ?? tee.colour ?? "Standard",
        colour: normaliseTeeColour(tee.colour),
        gender: normaliseGender(tee.gender),
        courseRating: tee.course_rating ?? undefined,
        slopeRating: tee.slope_rating ?? undefined,
        par: tee.par ?? course.par ?? 72,
        totalYards: tee.total_yardage ?? undefined,
        totalMeters: tee.total_metres ?? undefined,
        holes: [], // hole-by-hole data not available from this API
        dataSource: "golf_api_uk",
      });
    }

    imported++;
  }

  return { imported, clubName: club.name };
}

// ── Import action: GolfCourseAPI.com ──────────────────────────────────────────
//
// API: api.golfcourseapi.com
// Auth: GOLF_COURSE_API_KEY env var
// Free tier: 300 requests/day
//
// Note: search-only API (no country filter). SA courses identified by:
//   - location.country === "South Africa"
//   - location.state in SA province codes (GT, WC, KZN, EC, FS, LP, MP, NW, NC)
//
// Rate budget: 1 req per search term → chain with 3s delay to stay safe.

const GCA_BASE = "https://api.golfcourseapi.com/v1";

function gcaHeaders(apiKey: string) {
  return { Authorization: `Key ${apiKey}` };
}

// NL = legacy code for "Natal" (now KwaZulu-Natal) — still used by this API
const SA_PROVINCE_CODES = new Set(["GT", "WC", "KZN", "EC", "FS", "LP", "MP", "NW", "NC", "NL"]);
const SA_PROVINCE_NAMES: Record<string, string> = {
  GT: "Gauteng", WC: "Western Cape", KZN: "KwaZulu-Natal", NL: "KwaZulu-Natal",
  EC: "Eastern Cape", FS: "Free State", LP: "Limpopo",
  MP: "Mpumalanga", NW: "North West", NC: "Northern Cape",
};

// Known SA course IDs where location.country/state = "Unknown" in the API.
// Identified by targeted club-name searches; all confirmed South African.
const SA_KNOWN_COURSE_IDS = [
  16542, // Mount Edgecombe CC
  16677, // Blue Valley Golf Estate
  16747, // Champagne Sports Resort
  16810, // Pezula Championship Course
  16823, // Oubaai Golf Club
  16827, // Milnerton Golf Club
  16832, // Clovelly Country Club
  16846, // Bryanston Country Club
  16861, // Pearl Valley Golf & Country Estate
  16891, // Sun City Golf Club
  16892, // Royal Cape Golf Club
  16901, // Simola Golf & Country Estate
  16915, // Stellenbosch Golf Club
  16946, // Zwartkop Country Club
  16959, // Glendower Golf Club
  16960, // Mount Edgecombe GC - Papwa Sewgolum
  17006, // Steenberg Golf Club
  17037, // Kingswood Golf Estate
  17081, // Umhlali Country Club
  17087, // Westlake Golf Club
  17088, // Durban Country Club
  17089, // Wanderers Golf Club
  17109, // Humewood Golf Club
  17131, // Kloof Country Club
  17151, // Erinvale Golf Club
  17171, // Zimbali Country Club
  25415, // Fancourt (Outeniqua)
  25512, // Fancourt (Links)
  25605, // Arabella Country Estate
  25620, // Fancourt (Montagu)
  25659, // Parkview Golf Club
  25779, // George Golf Club
  25856, // Mount Edgecombe CC (alt record)
  // Additional confirmed SA courses found via location scan
  16650, // Bankenveld Golf Estate (Mpumalanga)
  17035, // Koro Creek Golf Estate (Limpopo)
];

// Search terms that appear in SA golf club names. Covers all 9 provinces.
const SA_SEARCH_TERMS = [
  // By city / region name in club name
  "johannesburg", "pretoria", "centurion", "midrand", "benoni", "boksburg",
  "kempton", "roodepoort", "krugersdorp", "soweto", "sandton", "randburg",
  "durban", "umhlali", "zimbali", "umhlanga", "pietermaritzburg", "selborne",
  "east london", "port elizabeth", "port alfred", "grahamstown",
  "bloemfontein", "polokwane", "nelspruit", "kimberley", "rustenburg",
  // By well-known SA club / resort name
  "leopard creek", "fancourt", "humewood", "pezula", "simola", "kingswood",
  "oubaai", "steenberg", "pearl valley", "arabella", "champagne sports",
  "sun city", "lost city", "gary player", "royal cape", "royal johannesburg",
  "westlake", "mowbray", "clovelly", "milnerton", "erinvale", "strand golf",
  "stellenbosch", "paarl", "hermanus",
  // By generic SA terms
  "rand", "vaal", "witwatersrand", "transvaal", "natal", "zwartkop",
  "glendower", "houghton", "wanderers", "dainfern", "kyalami", "irene",
  "woodlands", "parkview", "bryanston", "beachwood",
  // Additional SA cities / regions
  "emalahleni", "witbank", "modimolle", "welkom", "klerksdorp",
  "hazyview", "tzaneen", "phalaborwa", "mahikeng", "upington",
  "golf estate south", "selborne", "royal golf south",
];

function isSACourse(loc: any): boolean {
  return loc?.country === "South Africa" || SA_PROVINCE_CODES.has(loc?.state);
}

// Import a single course from GolfCourseAPI by numeric ID.
export const importFromGolfCourseApi = action({
  args: { courseId: v.number() },
  handler: async (ctx, { courseId }) => {
    const apiKey = process.env.GOLF_COURSE_API_KEY;
    if (!apiKey) throw new Error("GOLF_COURSE_API_KEY not set in Convex dashboard");

    const res = await fetch(`${GCA_BASE}/courses/${courseId}`, {
      headers: gcaHeaders(apiKey),
    });
    if (!res.ok) throw new Error(`GolfCourseAPI ${res.status}: ${await res.text()}`);
    const { course } = await res.json() as { course: any };

    return importGcaCourseRecord(ctx, course);
  },
});

// Bulk import South African courses. Chains through SA_SEARCH_TERMS at 3s intervals
// so we stay well within the 300 req/day free-tier limit.
// Super admin only — run once via: npx convex run golfCourses:startSAImport '{}'
export const startSAImport = action({
  args: { startIndex: v.optional(v.number()) },
  handler: async (ctx, { startIndex = 0 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !isSuperAdmin(identity.email)) throw new Error("Super admin only");
    await ctx.scheduler.runAfter(0, internal.golfCourses.saImportChain, {
      termIndex: startIndex,
      seenIds: [],
      totalImported: 0,
      totalSkipped: 0,
    });
    return { started: true, totalTerms: SA_SEARCH_TERMS.length };
  },
});

export const saImportChain = internalAction({
  args: {
    termIndex: v.number(),
    seenIds: v.array(v.number()),
    totalImported: v.number(),
    totalSkipped: v.number(),
  },
  handler: async (ctx, { termIndex, seenIds, totalImported, totalSkipped }) => {
    const apiKey = process.env.GOLF_COURSE_API_KEY;
    if (!apiKey) throw new Error("GOLF_COURSE_API_KEY not set");

    if (termIndex >= SA_SEARCH_TERMS.length) {
      console.log(`SA import complete — ${totalImported} courses imported, ${totalSkipped} skipped`);
      return;
    }

    const term = SA_SEARCH_TERMS[termIndex];
    const res = await fetch(
      `${GCA_BASE}/search?search_query=${encodeURIComponent(term)}`,
      { headers: gcaHeaders(apiKey) }
    );

    let imported = 0;
    let skipped = 0;
    const newSeenIds = [...seenIds];

    if (res.ok) {
      const { courses } = await res.json() as { courses: any[] };
      for (const course of courses ?? []) {
        if (!isSACourse(course.location)) { skipped++; continue; }
        if (newSeenIds.includes(course.id)) { skipped++; continue; }
        newSeenIds.push(course.id);
        try {
          await importGcaCourseRecord(ctx, course);
          imported++;
        } catch (e) {
          console.error(`SA import — failed "${course.club_name}":`, e);
          skipped++;
        }
      }
    } else {
      console.error(`SA import — search "${term}" failed: ${res.status}`);
    }

    console.log(`SA import [${termIndex + 1}/${SA_SEARCH_TERMS.length}] "${term}": +${imported} (${skipped} skipped)`);

    await ctx.scheduler.runAfter(3_000, internal.golfCourses.saImportChain, {
      termIndex: termIndex + 1,
      seenIds: newSeenIds,
      totalImported: totalImported + imported,
      totalSkipped: totalSkipped + skipped,
    });
  },
});

// Import the curated list of known SA course IDs (courses the search missed because
// the API has location.country/state = "Unknown" for them).
// Run via: npx convex run golfCourses:importKnownSACourses '{}'
export const importKnownSACourses = action({
  args: { startIndex: v.optional(v.number()) },
  handler: async (ctx, { startIndex = 0 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !isSuperAdmin(identity.email)) throw new Error("Super admin only");
    await ctx.scheduler.runAfter(0, internal.golfCourses.knownSAImportChain, {
      index: startIndex,
      imported: 0,
      skipped: 0,
    });
    return { started: true, total: SA_KNOWN_COURSE_IDS.length };
  },
});

export const knownSAImportChain = internalAction({
  args: { index: v.number(), imported: v.number(), skipped: v.number() },
  handler: async (ctx, { index, imported, skipped }) => {
    if (index >= SA_KNOWN_COURSE_IDS.length) {
      console.log(`Known SA import complete — ${imported} imported, ${skipped} skipped`);
      return;
    }

    const apiKey = process.env.GOLF_COURSE_API_KEY;
    if (!apiKey) throw new Error("GOLF_COURSE_API_KEY not set");

    const courseId = SA_KNOWN_COURSE_IDS[index];
    let thisImported = 0;
    let thisSkipped = 0;

    try {
      const res = await fetch(`${GCA_BASE}/courses/${courseId}`, {
        headers: gcaHeaders(apiKey),
      });
      if (res.ok) {
        const { course } = await res.json() as { course: any };
        // Force country to ZAF for these known SA courses regardless of API location data
        if (!course.location) course.location = {};
        if (!isSACourse(course.location)) {
          course.location.country = "South Africa";
        }
        await importGcaCourseRecord(ctx, course);
        console.log(`Known SA [${index + 1}/${SA_KNOWN_COURSE_IDS.length}] imported: ${course.club_name}`);
        thisImported = 1;
      } else {
        console.error(`Known SA [${index + 1}] course ${courseId} failed: ${res.status}`);
        thisSkipped = 1;
      }
    } catch (e) {
      console.error(`Known SA [${index + 1}] course ${courseId} error:`, e);
      thisSkipped = 1;
    }

    await ctx.scheduler.runAfter(2_000, internal.golfCourses.knownSAImportChain, {
      index: index + 1,
      imported: imported + thisImported,
      skipped: skipped + thisSkipped,
    });
  },
});

// Query to verify the SA import — checks data quality and returns a summary.
export const verifySAData = query({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.db
      .query("golfCourses")
      .withIndex("by_country", q => q.eq("country", "ZAF"))
      .collect();

    const teesByCountry = await Promise.all(
      courses.map(c =>
        ctx.db.query("courseTees").withIndex("by_course", q => q.eq("courseId", c._id)).collect()
      )
    );

    let withTees = 0, withRatings = 0, badRating = 0, badPar = 0;
    const byProvince: Record<string, number> = {};
    const badTees: Array<{ course: string; tee: string; courseRating?: number; slopeRating?: number }> = [];

    courses.forEach((c, i) => {
      const tees = teesByCountry[i];
      if (tees.length > 0) withTees++;
      if (tees.some(t => t.courseRating && t.slopeRating)) withRatings++;

      // Validate ratings
      for (const t of tees) {
        let bad = false;
        if (t.courseRating && (t.courseRating < 45 || t.courseRating > 90)) { badRating++; bad = true; }
        if (t.slopeRating && (t.slopeRating < 55 || t.slopeRating > 155)) { badRating++; bad = true; }
        if (t.par && (t.par < 27 || t.par > 75)) { badPar++; bad = true; }
        if (bad) badTees.push({ course: c.name, tee: t.name, courseRating: t.courseRating, slopeRating: t.slopeRating });
      }

      const prov = c.county ?? "Unknown";
      byProvince[prov] = (byProvince[prov] ?? 0) + 1;
    });

    return {
      totalCourses: courses.length,
      withTees,
      withRatings,
      badRatingValues: badRating,
      badParValues: badPar,
      byProvince,
      badTees,
    };
  },
});

// ── GolfCourseAPI.com internal helpers ────────────────────────────────────────

async function importGcaCourseRecord(ctx: any, course: any) {
  const loc = course.location ?? {};
  // Map state code to full province name; ignore non-SA/Unknown codes
  const rawState: string = loc.state ?? "";
  const province = SA_PROVINCE_NAMES[rawState] ?? (SA_PROVINCE_CODES.has(rawState) ? rawState : undefined);
  const clubName: string = course.club_name ?? "";
  const courseName: string = course.course_name ?? clubName;

  // Use course_name as primary name; club_name as venueName when they differ
  const name = courseName || clubName;
  const venueName = courseName !== clubName && clubName ? clubName : undefined;

  // Work out numberOfHoles from tees
  const allTees = [...(course.tees?.female ?? []), ...(course.tees?.male ?? [])];
  const numberOfHoles = allTees[0]?.number_of_holes ?? 18;

  const slug = makeSlug(name + "-za");

  const courseId: any = await ctx.runMutation(internal.golfCourses.internalUpsert, {
    name,
    venueName,
    slug,
    country: "ZAF",
    county: province,
    city: loc.city && loc.city !== "Unknown" ? loc.city : undefined,
    address: loc.address ?? undefined,
    latitude: typeof loc.latitude === "number" ? loc.latitude : undefined,
    longitude: typeof loc.longitude === "number" ? loc.longitude : undefined,
    numberOfHoles,
    golfCourseApiId: String(course.id),
    dataSource: "golf_course_api",
  });

  // Import tees (female then male)
  for (const [gender, teeList] of [["female", course.tees?.female ?? []], ["male", course.tees?.male ?? []]] as const) {
    for (const tee of teeList) {
      const holes = (tee.holes ?? []).map((h: any, i: number) => ({
        number: i + 1,
        par: h.par ?? 4,
        strokeIndex: i + 1, // SI not provided by this API — default to hole number
        yards: h.yardage ?? undefined,
      }));

      await ctx.runMutation(internal.golfCourses.internalUpsertTee, {
        courseId,
        name: tee.tee_name ?? "Standard",
        colour: normaliseTeeColour(tee.tee_name),
        gender,
        courseRating: tee.course_rating ?? undefined,
        slopeRating: tee.slope_rating ?? undefined,
        par: tee.par_total ?? 72,
        totalYards: tee.total_yards ?? undefined,
        totalMeters: tee.total_meters ?? undefined,
        holes,
        dataSource: "golf_course_api",
      });
    }
  }

  return { name, courseId };
}

// ── Field normalisers ─────────────────────────────────────────────────────────

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normaliseType(raw?: string): string {
  if (!raw) return "other";
  const t = raw.toLowerCase();
  if (t.includes("links")) return "links";
  if (t.includes("heath")) return "heathland";
  if (t.includes("moor")) return "moorland";
  if (t.includes("down")) return "downland";
  if (t.includes("park")) return "parkland";
  if (t.includes("desert")) return "desert";
  if (t.includes("mountain")) return "mountain";
  return "other";
}

function normaliseTeeColour(raw?: string): string {
  if (!raw) return "other";
  const t = raw.toLowerCase();
  for (const c of ["white", "yellow", "red", "blue", "black", "gold", "silver", "green"]) {
    if (t.includes(c)) return c;
  }
  return "other";
}

function normaliseGender(raw?: string): string {
  if (!raw) return "both";
  const t = raw.toLowerCase();
  if (t.includes("lad") || t.includes("wom") || t.includes("fem")) return "female";
  if (t.includes("men") || t.includes("gen") || t.includes("male")) return "male";
  return "both";
}

// ── Import action: Handicap Network Africa (handicaps.co.za) ──────────────────
//
// Unofficial JSON API discovered from page JS — no auth required (public data).
//
// Per-club flow (3–4 HTTP requests):
//   1. getCourses?clubId=N        → [{CourseId, Name}]
//   2. GetClubDetails?clubId=N    → {ClubName, Latitude, Longitude, RegionName, ...}
//   3. GetHoles?clubId=N          → [{HoleValue: "MN"|"WN"|"MY"|"WY"}]
//   4. getMarkers?courseId=X&gender=M|W&isNineHoles=true|false&memberUid=
//                                 → [{DisplayMarkerName, UsgaNzcr, SlopeRating, MarkerColor, Holes:[...]}]
//
// Club IDs are sequential ints. The chain stops after MAX_EMPTY_STREAK consecutive
// empty-course responses (meaning we've passed the last club).
//
// Run via: npx convex run golfCourses:startHNAImport '{}'

const HNA_BASE = "https://www.handicaps.co.za/api/clubs";
const HNA_MAX_EMPTY_STREAK = 50; // stop after 50 consecutive missing clubs

// Import a single HNA club by numeric club ID. Safe to call directly for testing.
// npx convex run golfCourses:importHNAClub '{"clubId":39}'
export const importHNAClub = internalAction({
  args: { clubId: v.number() },
  handler: async (ctx, { clubId }) => {
    // 1. Courses
    const coursesRes = await fetch(`${HNA_BASE}/getCourses?clubId=${clubId}`);
    if (!coursesRes.ok) return { clubId, status: "error" as const, error: `getCourses ${coursesRes.status}` };
    const courses: any[] = await coursesRes.json();
    if (!courses || courses.length === 0) return { clubId, status: "not_found" as const };

    // 2. Club details
    const detailRes = await fetch(`${HNA_BASE}/GetClubDetails?clubId=${clubId}`);
    if (!detailRes.ok) return { clubId, status: "error" as const, error: `GetClubDetails ${detailRes.status}` };
    const detail: any = await detailRes.json();
    const clubName: string = detail.ClubName ?? courses[0]?.Name ?? `Club ${clubId}`;

    // 3. Hole modes
    const holesRes = await fetch(`${HNA_BASE}/GetHoles?clubId=${clubId}`);
    if (!holesRes.ok) return { clubId, status: "error" as const, error: `GetHoles ${holesRes.status}` };
    const holeModes: any[] = await holesRes.json();

    // Only process 18-hole modes — 9-hole has same tees, just filtered holes
    const modes18 = holeModes.filter((m: any) => m.HoleValue?.[1] !== 'Y');

    let totalTees = 0;

    for (const course of courses) {
      const courseId = course.CourseId;
      const courseName = courses.length > 1 ? (course.Name ?? clubName) : clubName;
      const slug = makeSlug(courseName + "-za");

      const addressParts = [
        detail.LocAddress1, detail.LocAddress2,
        detail.LocAddress3, detail.LocAddress4,
      ].filter(Boolean);

      const golfCourseId: any = await ctx.runMutation(internal.golfCourses.internalUpsert, {
        name: hnaTitle(courseName),
        venueName: courses.length > 1 ? hnaTitle(clubName) : undefined,
        slug,
        country: "ZAF",
        county: detail.RegionName ?? undefined,
        city: detail.LocAddress4 ?? undefined,
        address: addressParts.join(", ") || undefined,
        postcode: detail.PostalCode ?? undefined,
        latitude: typeof detail.Latitude === "number" && detail.Latitude !== 0 ? detail.Latitude : undefined,
        longitude: typeof detail.Longitude === "number" && detail.Longitude !== 0 ? detail.Longitude : undefined,
        numberOfHoles: 18,
        website: detail.Website?.startsWith("http") ? detail.Website : undefined,
        phone: detail.Phone || undefined,
        hnaClubId: String(clubId),
        dataSource: "hna",
      });

      // 4. Markers per mode
      for (const mode of modes18) {
        const holeValue: string = mode.HoleValue ?? "";
        const gender = holeValue[0] === "W" ? "W" : "M";
        const markersRes = await fetch(
          `${HNA_BASE}/getMarkers?courseId=${courseId}&gender=${gender}&isNineHoles=false&memberUid=`
        );
        if (!markersRes.ok) continue;
        const markers: any[] = await markersRes.json();
        if (!markers || markers.length === 0) continue;

        for (const marker of markers) {
          const holes = (marker.Holes ?? []).map((h: any, i: number) => ({
            number: parseInt(h.Alias, 10) || i + 1,
            par: h.Par ?? 4,
            strokeIndex: h.Stroke ?? (i + 1),
            meters: h.DistanceMetres ?? h.Distance ?? undefined,
            yards: h.DistanceYards ?? undefined,
          }));

          const par = holes.reduce((s: number, h: any) => s + (h.par ?? 0), 0) || 72;
          const totalMeters = holes.reduce((s: number, h: any) => s + (h.meters ?? 0), 0) || undefined;

          const cr = typeof marker.UsgaNzcr === "number" && marker.UsgaNzcr > 0
            ? marker.UsgaNzcr : undefined;
          const slope = typeof marker.SlopeRating === "number" && marker.SlopeRating > 0
            ? marker.SlopeRating : undefined;

          await ctx.runMutation(internal.golfCourses.internalUpsertTee, {
            courseId: golfCourseId,
            name: marker.DisplayMarkerName ?? "Standard",
            colour: hnaColour(marker.DisplayMarkerName, marker.MarkerColor),
            gender: gender === "W" ? "female" : "male",
            courseRating: cr,
            slopeRating: slope,
            par,
            totalMeters,
            holes,
            dataSource: "hna",
          });
          totalTees++;
        }
      }
    }

    return { clubId, status: "ok" as const, clubName: hnaTitle(clubName), courses: courses.length, tees: totalTees };
  },
});

// Accept pre-scraped club data (from hna-courses.json) and write to DB.
// Called by upload-hna-courses.mjs via the Convex HTTP client.
export const importHNAClubData = action({
  args: {
    hnaClubId: v.number(),
    name: v.string(),
    country: v.string(),
    region: v.optional(v.string()),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    postcode: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    courses: v.array(v.object({
      name: v.string(),
      venueName: v.optional(v.string()),
      tees: v.array(v.object({
        name: v.string(),
        markerColor: v.optional(v.string()),
        gender: v.string(),
        courseRating: v.optional(v.number()),
        slopeRating: v.optional(v.number()),
        par: v.number(),
        totalMeters: v.optional(v.number()),
        holes: v.array(v.object({
          number: v.number(),
          par: v.number(),
          strokeIndex: v.number(),
          meters: v.optional(v.number()),
          yards: v.optional(v.number()),
        })),
      })),
    })),
  },
  handler: async (ctx, args) => {
    for (const course of args.courses) {
      const slug = makeSlug(course.name + "-za");
      const golfCourseId: any = await ctx.runMutation(internal.golfCourses.internalUpsert, {
        name: course.name,
        venueName: course.venueName ?? undefined,
        slug,
        country: args.country,
        county: args.region ?? undefined,
        city: args.city ?? undefined,
        address: args.address ?? undefined,
        postcode: args.postcode ?? undefined,
        latitude: args.latitude ?? undefined,
        longitude: args.longitude ?? undefined,
        numberOfHoles: 18,
        website: args.website ?? undefined,
        phone: args.phone ?? undefined,
        hnaClubId: String(args.hnaClubId),
        dataSource: "hna",
      });

      for (const tee of course.tees) {
        await ctx.runMutation(internal.golfCourses.internalUpsertTee, {
          courseId: golfCourseId,
          name: tee.name,
          colour: hnaColour(tee.name, tee.markerColor ?? undefined),
          gender: tee.gender,
          courseRating: tee.courseRating ?? undefined,
          slopeRating: tee.slopeRating ?? undefined,
          par: tee.par,
          totalMeters: tee.totalMeters ?? undefined,
          holes: tee.holes,
          dataSource: "hna",
        });
      }
    }
    return { ok: true };
  },
});

// Start the full HNA bulk import. Chains through IDs from startId upward.
// Run via: npx convex run golfCourses:startHNAImport '{}'
export const startHNAImport = action({
  args: { startId: v.optional(v.number()) },
  handler: async (ctx, { startId = 1 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !isSuperAdmin(identity.email)) throw new Error("Super admin only");
    await ctx.scheduler.runAfter(0, internal.golfCourses.hnaImportChain, {
      clubId: startId,
      emptyStreak: 0,
      totalImported: 0,
      totalSkipped: 0,
    });
    return { started: true, startId };
  },
});

export const hnaImportChain = internalAction({
  args: {
    clubId: v.number(),
    emptyStreak: v.number(),
    totalImported: v.number(),
    totalSkipped: v.number(),
  },
  handler: async (ctx, { clubId, emptyStreak, totalImported, totalSkipped }) => {
    if (emptyStreak >= HNA_MAX_EMPTY_STREAK) {
      console.log(`HNA import complete after clubId ${clubId - 1} — ${totalImported} imported, ${totalSkipped} skipped`);
      return;
    }

    let thisImported = 0;
    let thisSkipped = 0;
    let newEmptyStreak = emptyStreak;

    try {
      const result: any = await ctx.runAction(internal.golfCourses.importHNAClub, { clubId });
      if (result.status === "ok") {
        console.log(`HNA [${clubId}] ${result.clubName}: ${result.courses} courses, ${result.tees} tees`);
        thisImported = 1;
        newEmptyStreak = 0;
      } else if (result.status === "not_found") {
        newEmptyStreak = emptyStreak + 1;
        thisSkipped = 1;
      } else {
        console.error(`HNA [${clubId}] error: ${result.error}`);
        thisSkipped = 1;
        newEmptyStreak = emptyStreak + 1;
      }
    } catch (e) {
      console.error(`HNA [${clubId}] threw:`, e);
      thisSkipped = 1;
      newEmptyStreak = emptyStreak + 1;
    }

    // 2s delay — respectful to the site, ~30 clubs/min
    await ctx.scheduler.runAfter(2_000, internal.golfCourses.hnaImportChain, {
      clubId: clubId + 1,
      emptyStreak: newEmptyStreak,
      totalImported: totalImported + thisImported,
      totalSkipped: totalSkipped + thisSkipped,
    });
  },
});

// ── HNA helpers ───────────────────────────────────────────────────────────────

// Convert all-caps club names from HNA to title case
function hnaTitle(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Map HNA display name or hex marker colour to our colour enum
function hnaColour(displayName?: string, hexColor?: string): string {
  if (displayName) {
    const d = displayName.toLowerCase();
    for (const c of ["white", "yellow", "red", "blue", "black", "gold", "silver", "green"]) {
      if (d.includes(c)) return c;
    }
  }
  // Fallback: hex colour
  if (hexColor) {
    const h = hexColor.toLowerCase().replace("#", "");
    if (h === "ffffff" || h === "fff") return "white";
    if (h.startsWith("ff0") || h === "ff0000") return "red";
    if (h === "ffff00" || h === "ffff") return "yellow";
    if (h.startsWith("0000") || h === "000080") return "blue";
    if (h === "000000" || h === "000") return "black";
    if (h.startsWith("808") || h === "c0c0c0") return "silver";
    if (h.startsWith("ffd") || h.startsWith("daa")) return "gold";
    if (h.startsWith("00") && h.includes("00ff")) return "green";
  }
  return "other";
}
