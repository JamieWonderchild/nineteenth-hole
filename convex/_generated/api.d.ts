/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _internal_posHelpers from "../_internal/posHelpers.js";
import type * as clubMembers from "../clubMembers.js";
import type * as clubs from "../clubs.js";
import type * as communications from "../communications.js";
import type * as competitions from "../competitions.js";
import type * as corti from "../corti.js";
import type * as courseRatings from "../courseRatings.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as drawGrievances from "../drawGrievances.js";
import type * as entries from "../entries.js";
import type * as fixtureAvailability from "../fixtureAvailability.js";
import type * as golfClubs from "../golfClubs.js";
import type * as golfCourses from "../golfCourses.js";
import type * as golferProfiles from "../golferProfiles.js";
import type * as handicap from "../handicap.js";
import type * as http from "../http.js";
import type * as interclub from "../interclub.js";
import type * as invites from "../invites.js";
import type * as knockouts from "../knockouts.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as memberAccounts from "../memberAccounts.js";
import type * as membershipCategories from "../membershipCategories.js";
import type * as messaging from "../messaging.js";
import type * as notifications from "../notifications.js";
import type * as players from "../players.js";
import type * as pos from "../pos.js";
import type * as posLocations from "../posLocations.js";
import type * as posShifts from "../posShifts.js";
import type * as posTabs from "../posTabs.js";
import type * as posTerminals from "../posTerminals.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as quickGames from "../quickGames.js";
import type * as resultsImport from "../resultsImport.js";
import type * as rounds from "../rounds.js";
import type * as scores from "../scores.js";
import type * as scoring from "../scoring.js";
import type * as seedMasters2026 from "../seedMasters2026.js";
import type * as series from "../series.js";
import type * as squadMembers from "../squadMembers.js";
import type * as teeTimes from "../teeTimes.js";
import type * as trips from "../trips.js";
import type * as visitors from "../visitors.js";
import type * as wallet from "../wallet.js";
import type * as webhookEvents from "../webhookEvents.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_internal/posHelpers": typeof _internal_posHelpers;
  clubMembers: typeof clubMembers;
  clubs: typeof clubs;
  communications: typeof communications;
  competitions: typeof competitions;
  corti: typeof corti;
  courseRatings: typeof courseRatings;
  courses: typeof courses;
  crons: typeof crons;
  drawGrievances: typeof drawGrievances;
  entries: typeof entries;
  fixtureAvailability: typeof fixtureAvailability;
  golfClubs: typeof golfClubs;
  golfCourses: typeof golfCourses;
  golferProfiles: typeof golferProfiles;
  handicap: typeof handicap;
  http: typeof http;
  interclub: typeof interclub;
  invites: typeof invites;
  knockouts: typeof knockouts;
  "lib/encryption": typeof lib_encryption;
  memberAccounts: typeof memberAccounts;
  membershipCategories: typeof membershipCategories;
  messaging: typeof messaging;
  notifications: typeof notifications;
  players: typeof players;
  pos: typeof pos;
  posLocations: typeof posLocations;
  posShifts: typeof posShifts;
  posTabs: typeof posTabs;
  posTerminals: typeof posTerminals;
  pushNotifications: typeof pushNotifications;
  quickGames: typeof quickGames;
  resultsImport: typeof resultsImport;
  rounds: typeof rounds;
  scores: typeof scores;
  scoring: typeof scoring;
  seedMasters2026: typeof seedMasters2026;
  series: typeof series;
  squadMembers: typeof squadMembers;
  teeTimes: typeof teeTimes;
  trips: typeof trips;
  visitors: typeof visitors;
  wallet: typeof wallet;
  webhookEvents: typeof webhookEvents;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
