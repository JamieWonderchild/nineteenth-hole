import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "expire trials",
  { hourUTC: 6, minuteUTC: 0 },
  internal.organizations.expireTrials,
);

export default crons;
