#!/usr/bin/env node
/**
 * scrape-hna-courses.mjs
 *
 * Scrapes all South African golf clubs from Handicap Network Africa
 * (handicaps.co.za) and saves the full structured data as JSON.
 *
 * Output: scripts/hna-courses.json
 *
 * Usage:
 *   node scripts/scrape-hna-courses.mjs
 *   node scripts/scrape-hna-courses.mjs --start 100 --end 500
 *   node scripts/scrape-hna-courses.mjs --resume   # appends to existing file
 *
 * Then upload to Convex:
 *   node scripts/upload-hna-courses.mjs
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { setTimeout as sleep } from "timers/promises";

const BASE = "https://www.handicaps.co.za/api/clubs";
const OUTPUT_FILE = new URL("./hna-courses.json", import.meta.url).pathname;
const PROGRESS_FILE = new URL("./hna-progress.json", import.meta.url).pathname;

// --- CLI args ---
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const RESUME = args.includes("--resume");
const START_ID = parseInt(getArg("--start") ?? "1", 10);
const END_ID = parseInt(getArg("--end") ?? "9999", 10);
const DELAY_MS = parseInt(getArg("--delay") ?? "300", 10); // ms between clubs
const MAX_EMPTY_STREAK = parseInt(getArg("--max-empty") ?? "50", 10);

// --- State ---
let results = [];
let progress = { lastId: START_ID - 1, emptyStreak: 0 };

if (RESUME && existsSync(OUTPUT_FILE)) {
  try {
    results = JSON.parse(readFileSync(OUTPUT_FILE, "utf8"));
    console.log(`Resuming — loaded ${results.length} existing clubs`);
  } catch {
    console.warn("Could not load existing output, starting fresh");
  }
}
if (RESUME && existsSync(PROGRESS_FILE)) {
  try {
    progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
    console.log(`Resuming from clubId ${progress.lastId + 1}`);
  } catch {}
}

const startId = RESUME ? progress.lastId + 1 : START_ID;

// --- Fetch helpers ---
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// --- Title-case helper (HNA names are ALL CAPS) ---
function titleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// --- Main ---
async function scrapeClub(clubId) {
  // 1. Get courses
  const courses = await fetchJson(`${BASE}/getCourses?clubId=${clubId}`);
  if (!courses || courses.length === 0) return null;

  // 2. Get details
  const detail = await fetchJson(`${BASE}/GetClubDetails?clubId=${clubId}`);
  if (!detail) return null;

  const clubName = titleCase(detail.ClubName ?? courses[0]?.Name ?? `Club ${clubId}`);

  // 3. Get hole modes
  const holeModes = await fetchJson(`${BASE}/GetHoles?clubId=${clubId}`) ?? [];
  const modes18 = holeModes.filter(m => m.HoleValue?.[1] !== "Y"); // exclude 9-hole variants

  const clubData = {
    hnaClubId: clubId,
    name: clubName,
    country: "ZAF",
    region: detail.RegionName ?? null,
    city: detail.LocAddress4 ?? null,
    address: [detail.LocAddress1, detail.LocAddress2, detail.LocAddress3, detail.LocAddress4]
      .filter(Boolean).join(", ") || null,
    postcode: detail.PostalCode ?? null,
    latitude: typeof detail.Latitude === "number" && detail.Latitude !== 0 ? detail.Latitude : null,
    longitude: typeof detail.Longitude === "number" && detail.Longitude !== 0 ? detail.Longitude : null,
    phone: detail.Phone || null,
    website: detail.Website?.startsWith("http") ? detail.Website : null,
    email: detail.Email || null,
    courses: [],
  };

  for (const course of courses) {
    const courseId = course.CourseId;
    const courseName = courses.length > 1 ? titleCase(course.Name ?? clubName) : clubName;

    const courseData = {
      hnaId: courseId,
      name: courseName,
      venueName: courses.length > 1 ? clubName : null,
      tees: [],
    };

    for (const mode of modes18) {
      const holeValue = mode.HoleValue ?? "";
      const gender = holeValue[0] === "W" ? "W" : "M";

      const markers = await fetchJson(
        `${BASE}/getMarkers?courseId=${courseId}&gender=${gender}&isNineHoles=false&memberUid=`
      );
      if (!markers || markers.length === 0) continue;

      for (const marker of markers) {
        const holes = (marker.Holes ?? []).map((h, i) => ({
          number: parseInt(h.Alias, 10) || i + 1,
          par: h.Par ?? 4,
          strokeIndex: h.Stroke ?? (i + 1),
          meters: h.DistanceMetres ?? h.Distance ?? null,
          yards: h.DistanceYards ?? null,
        }));

        const par = holes.reduce((s, h) => s + (h.par ?? 0), 0) || 72;
        const totalMeters = holes.reduce((s, h) => s + (h.meters ?? 0), 0) || null;

        courseData.tees.push({
          name: marker.DisplayMarkerName ?? "Standard",
          markerColor: marker.MarkerColor ?? null,
          gender: gender === "W" ? "female" : "male",
          courseRating: typeof marker.UsgaNzcr === "number" && marker.UsgaNzcr > 0
            ? marker.UsgaNzcr : null,
          slopeRating: typeof marker.SlopeRating === "number" && marker.SlopeRating > 0
            ? marker.SlopeRating : null,
          par,
          totalMeters,
          holes,
        });
      }
    }

    clubData.courses.push(courseData);
  }

  return clubData;
}

async function main() {
  console.log(`Scraping HNA clubs ${startId}–${END_ID} (delay: ${DELAY_MS}ms, max empty streak: ${MAX_EMPTY_STREAK})`);
  console.log(`Output: ${OUTPUT_FILE}\n`);

  let emptyStreak = RESUME ? progress.emptyStreak : 0;
  let imported = 0;
  let skipped = 0;

  for (let clubId = startId; clubId <= END_ID; clubId++) {
    if (emptyStreak >= MAX_EMPTY_STREAK) {
      console.log(`\nStopping — ${MAX_EMPTY_STREAK} consecutive empty clubs (last ID: ${clubId - 1})`);
      break;
    }

    try {
      const club = await scrapeClub(clubId);

      if (club) {
        results.push(club);
        imported++;
        emptyStreak = 0;

        const teesTotal = club.courses.reduce((s, c) => s + c.tees.length, 0);
        process.stdout.write(`\r[${clubId}] ${club.name} — ${club.courses.length} course(s), ${teesTotal} tees  `);

        // Save every 10 clubs
        if (imported % 10 === 0) {
          writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
          writeFileSync(PROGRESS_FILE, JSON.stringify({ lastId: clubId, emptyStreak }));
        }
      } else {
        skipped++;
        emptyStreak++;
        process.stdout.write(`\r[${clubId}] not found (streak: ${emptyStreak})           `);
      }
    } catch (err) {
      console.error(`\n[${clubId}] Error:`, err.message);
      skipped++;
      emptyStreak++;
    }

    await sleep(DELAY_MS);
  }

  // Final save
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  writeFileSync(PROGRESS_FILE, JSON.stringify({ lastId: END_ID, emptyStreak }));

  console.log(`\n\nDone! ${imported} clubs imported, ${skipped} skipped.`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
