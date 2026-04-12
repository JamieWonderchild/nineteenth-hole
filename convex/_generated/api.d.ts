/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as clubMembers from "../clubMembers.js";
import type * as clubs from "../clubs.js";
import type * as communications from "../communications.js";
import type * as competitions from "../competitions.js";
import type * as corti from "../corti.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as entries from "../entries.js";
import type * as fixtureAvailability from "../fixtureAvailability.js";
import type * as golfClubs from "../golfClubs.js";
import type * as golferProfiles from "../golferProfiles.js";
import type * as http from "../http.js";
import type * as interclub from "../interclub.js";
import type * as invites from "../invites.js";
import type * as knockouts from "../knockouts.js";
import type * as memberAccounts from "../memberAccounts.js";
import type * as membershipCategories from "../membershipCategories.js";
import type * as messaging from "../messaging.js";
import type * as players from "../players.js";
import type * as pos from "../pos.js";
import type * as quickGames from "../quickGames.js";
import type * as resultsImport from "../resultsImport.js";
import type * as scores from "../scores.js";
import type * as scoring from "../scoring.js";
import type * as series from "../series.js";
import type * as squadMembers from "../squadMembers.js";
import type * as teeTimes from "../teeTimes.js";
import type * as visitors from "../visitors.js";
import type * as webhookEvents from "../webhookEvents.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  clubMembers: typeof clubMembers;
  clubs: typeof clubs;
  communications: typeof communications;
  competitions: typeof competitions;
  corti: typeof corti;
  courses: typeof courses;
  crons: typeof crons;
  entries: typeof entries;
  fixtureAvailability: typeof fixtureAvailability;
  golfClubs: typeof golfClubs;
  golferProfiles: typeof golferProfiles;
  http: typeof http;
  interclub: typeof interclub;
  invites: typeof invites;
  knockouts: typeof knockouts;
  memberAccounts: typeof memberAccounts;
  membershipCategories: typeof membershipCategories;
  messaging: typeof messaging;
  players: typeof players;
  pos: typeof pos;
  quickGames: typeof quickGames;
  resultsImport: typeof resultsImport;
  scores: typeof scores;
  scoring: typeof scoring;
  series: typeof series;
  squadMembers: typeof squadMembers;
  teeTimes: typeof teeTimes;
  visitors: typeof visitors;
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
