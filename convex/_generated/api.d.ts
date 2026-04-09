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
import type * as competitions from "../competitions.js";
import type * as crons from "../crons.js";
import type * as entries from "../entries.js";
import type * as http from "../http.js";
import type * as players from "../players.js";
import type * as quickGames from "../quickGames.js";
import type * as resultsImport from "../resultsImport.js";
import type * as scores from "../scores.js";
import type * as series from "../series.js";
import type * as teeTimes from "../teeTimes.js";
import type * as webhookEvents from "../webhookEvents.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  clubMembers: typeof clubMembers;
  clubs: typeof clubs;
  competitions: typeof competitions;
  crons: typeof crons;
  entries: typeof entries;
  http: typeof http;
  players: typeof players;
  quickGames: typeof quickGames;
  resultsImport: typeof resultsImport;
  scores: typeof scores;
  series: typeof series;
  teeTimes: typeof teeTimes;
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
