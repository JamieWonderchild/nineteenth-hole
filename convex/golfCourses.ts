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
    return { ...course, tees };
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
  },
  handler: async (ctx, { latitude, longitude, radiusMiles = 25, limit = 20 }) => {
    const latDelta = radiusMiles / 69;
    const lngDelta = radiusMiles / (69 * Math.cos((latitude * Math.PI) / 180));
    return ctx.db
      .query("golfCourses")
      .withIndex("by_country", q => q.eq("country", "ENG"))
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
