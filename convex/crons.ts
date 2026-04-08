import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync scores every 5 minutes during tournament hours
crons.interval(
  "sync-live-scores",
  { minutes: 5 },
  internal.scores.syncAllLive,
  {}
);

export default crons;
