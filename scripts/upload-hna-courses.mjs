#!/usr/bin/env node
/**
 * upload-hna-courses.mjs
 *
 * Reads hna-courses.json (produced by scrape-hna-courses.mjs) and uploads
 * every club to Convex.
 *
 * Usage:
 *   node scripts/upload-hna-courses.mjs
 *   node scripts/upload-hna-courses.mjs --start 50   # resume from index 50
 *
 * Requires CONVEX_URL env var (your Convex deployment URL).
 * Find it in the Convex dashboard or .env.local.
 */

import { readFileSync } from "fs";
import { setTimeout as sleep } from "timers/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const INPUT_FILE = new URL("./hna-courses.json", import.meta.url).pathname;

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const START_INDEX = parseInt(getArg("--start") ?? "0", 10);
const DELAY_MS = parseInt(getArg("--delay") ?? "100", 10);

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Error: CONVEX_URL env var not set.");
  console.error("  export CONVEX_URL=https://your-deployment.convex.cloud");
  console.error("  (find this in your Convex dashboard or .env.local)");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  const clubs = JSON.parse(readFileSync(INPUT_FILE, "utf8"));
  console.log(`Loaded ${clubs.length} clubs from ${INPUT_FILE}`);
  console.log(`Uploading from index ${START_INDEX}...\n`);

  let ok = 0, failed = 0;

  for (let i = START_INDEX; i < clubs.length; i++) {
    const club = clubs[i];
    try {
      await client.action(api.golfCourses.importHNAClubData, {
        hnaClubId: club.hnaClubId,
        name: club.name,
        country: club.country,
        region: club.region ?? undefined,
        city: club.city ?? undefined,
        address: club.address ?? undefined,
        postcode: club.postcode ?? undefined,
        latitude: club.latitude ?? undefined,
        longitude: club.longitude ?? undefined,
        phone: club.phone ?? undefined,
        website: club.website ?? undefined,
        courses: club.courses.map(c => ({
          name: c.name,
          venueName: c.venueName ?? undefined,
          tees: c.tees.map(t => ({
            name: t.name,
            markerColor: t.markerColor ?? undefined,
            gender: t.gender,
            courseRating: t.courseRating ?? undefined,
            slopeRating: t.slopeRating ?? undefined,
            par: t.par,
            totalMeters: t.totalMeters ?? undefined,
            holes: t.holes.map(h => ({
              number: h.number,
              par: h.par,
              strokeIndex: h.strokeIndex,
              meters: h.meters ?? undefined,
              yards: h.yards ?? undefined,
            })),
          })),
        })),
      });
      ok++;
      process.stdout.write(`\r[${i + 1}/${clubs.length}] ${club.name}  `);
    } catch (err) {
      failed++;
      console.error(`\n[${i + 1}] Failed (${club.name}):`, err.message);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n\nUpload complete: ${ok} clubs uploaded, ${failed} failed.`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
