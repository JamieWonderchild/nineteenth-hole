/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminDiagnostics from "../adminDiagnostics.js";
import type * as analytics from "../analytics.js";
import type * as appointments from "../appointments.js";
import type * as auditLogs from "../auditLogs.js";
import type * as billingCatalog from "../billingCatalog.js";
import type * as billingDashboard from "../billingDashboard.js";
import type * as billingExtraction from "../billingExtraction.js";
import type * as billingItems from "../billingItems.js";
import type * as billingReconciliation from "../billingReconciliation.js";
import type * as caseReasoningSessions from "../caseReasoningSessions.js";
import type * as cleanupDuplicates from "../cleanupDuplicates.js";
import type * as companions from "../companions.js";
import type * as consistency from "../consistency.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as debugHelpers from "../debugHelpers.js";
import type * as encounters from "../encounters.js";
import type * as errorLogs from "../errorLogs.js";
import type * as evidenceFiles from "../evidenceFiles.js";
import type * as followups from "../followups.js";
import type * as invitations from "../invitations.js";
import type * as invoices from "../invoices.js";
import type * as lib_taxCalculations from "../lib/taxCalculations.js";
import type * as locations from "../locations.js";
import type * as memberships from "../memberships.js";
import type * as migrations_addLocationSupport from "../migrations/addLocationSupport.js";
import type * as onboarding from "../onboarding.js";
import type * as orderOrchestration from "../orderOrchestration.js";
import type * as organizationSetup from "../organizationSetup.js";
import type * as organizations from "../organizations.js";
import type * as patientProfiles from "../patientProfiles.js";
import type * as patients from "../patients.js";
import type * as permissions from "../permissions.js";
import type * as providers from "../providers.js";
import type * as recordings from "../recordings.js";
import type * as repair from "../repair.js";
import type * as resultsTriage from "../resultsTriage.js";
import type * as seedBillingCatalog from "../seedBillingCatalog.js";
import type * as testHelpers from "../testHelpers.js";
import type * as upgrade from "../upgrade.js";
import type * as usage from "../usage.js";
import type * as userPreferences from "../userPreferences.js";
import type * as webhookEvents from "../webhookEvents.js";
import type * as wipe from "../wipe.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminDiagnostics: typeof adminDiagnostics;
  analytics: typeof analytics;
  appointments: typeof appointments;
  auditLogs: typeof auditLogs;
  billingCatalog: typeof billingCatalog;
  billingDashboard: typeof billingDashboard;
  billingExtraction: typeof billingExtraction;
  billingItems: typeof billingItems;
  billingReconciliation: typeof billingReconciliation;
  caseReasoningSessions: typeof caseReasoningSessions;
  cleanupDuplicates: typeof cleanupDuplicates;
  companions: typeof companions;
  consistency: typeof consistency;
  crons: typeof crons;
  debug: typeof debug;
  debugHelpers: typeof debugHelpers;
  encounters: typeof encounters;
  errorLogs: typeof errorLogs;
  evidenceFiles: typeof evidenceFiles;
  followups: typeof followups;
  invitations: typeof invitations;
  invoices: typeof invoices;
  "lib/taxCalculations": typeof lib_taxCalculations;
  locations: typeof locations;
  memberships: typeof memberships;
  "migrations/addLocationSupport": typeof migrations_addLocationSupport;
  onboarding: typeof onboarding;
  orderOrchestration: typeof orderOrchestration;
  organizationSetup: typeof organizationSetup;
  organizations: typeof organizations;
  patientProfiles: typeof patientProfiles;
  patients: typeof patients;
  permissions: typeof permissions;
  providers: typeof providers;
  recordings: typeof recordings;
  repair: typeof repair;
  resultsTriage: typeof resultsTriage;
  seedBillingCatalog: typeof seedBillingCatalog;
  testHelpers: typeof testHelpers;
  upgrade: typeof upgrade;
  usage: typeof usage;
  userPreferences: typeof userPreferences;
  webhookEvents: typeof webhookEvents;
  wipe: typeof wipe;
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
