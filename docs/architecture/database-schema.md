# Database Schema

All tables live in Convex. Source of truth: `convex/schema.ts`.

---

## Organizations & Access

### `organizations`
Core org record. Created when a Clerk org is created (via webhook) or when a solo vet signs up.

| Field | Type | Notes |
|-------|------|-------|
| name | string | Display name |
| slug | string | URL-safe identifier |
| clerkOrgId | string? | Links to Clerk organization |
| plan | string | `'solo'` \| `'practice'` \| `'multi-location'` |
| billingStatus | string | `'trialing'` \| `'active'` \| `'past_due'` \| `'canceled'` \| `'unpaid'` \| `'incomplete'` |
| stripeCustomerId | string? | Stripe customer ID |
| stripeSubscriptionId | string? | Active subscription ID |
| trialEndsAt | string? | ISO date |
| maxVetSeats | number | Seat limit for plan |
| clinicName, clinicPhone, clinicEmail, clinicAddress, emergencyPhone | string? | Clinic contact info |
| billingCurrency | string? | `"USD"`, `"EUR"`, `"GBP"`, etc. |
| taxSettings | object? | See tax config below |
| needsLocationReview | boolean? | Flag for migration |
| lastPlanChange | object? | `{ fromPlan, toPlan, changedAt, wizardCompleted }` |

**Tax settings:**
```typescript
taxSettings: {
  enabled: boolean,
  rate: number,              // 8.5 = 8.5%
  name: string,              // "VAT", "GST", "Sales Tax"
  currency: string,
  includedInPrices: boolean, // true = tax-inclusive (EU/UK), false = tax-exclusive (US/CA)
}
```

**Indexes:** `by_clerk_org`, `by_slug`, `by_stripe_customer`, `by_billing_status`

---

### `memberships`
Links Clerk users to orgs with roles.

| Field | Type | Notes |
|-------|------|-------|
| orgId | Id<"organizations"> | |
| userId | string | Clerk user ID |
| role | string | `'owner'` \| `'admin'` \| `'practice-admin'` \| `'vet'` |
| status | string | `'active'` \| `'pending'` \| `'deactivated'` |
| locationIds | Id<"locations">[]? | Empty = org-wide access; populated = location-scoped |
| archivedAt / archivedReason | string? | Set on plan downgrade |

**Indexes:** `by_org`, `by_user`, `by_org_user`

---

### `locations`
Physical clinic locations. Multi-location orgs can have many; solo/practice orgs have one default.

| Field | Type | Notes |
|-------|------|-------|
| orgId | Id<"organizations"> | |
| name | string | |
| address, phone | string? | |
| isDefault | boolean | |
| archivedAt / archivedReason | string? | Set on plan downgrade |

**Indexes:** `by_org`

---

### `invitations`
Email invites to join an org. Token-based, expires in 7 days.

| Field | Type | Notes |
|-------|------|-------|
| orgId | Id<"organizations"> | |
| email, role | string | |
| token | string | Secure random, used in invite link |
| status | string | `'pending'` \| `'accepted'` \| `'expired'` \| `'cancelled'` |
| locationIds | Id<"locations">[]? | For practice-admin scoping |
| expiresAt | string | ISO date |

**Indexes:** `by_token`, `by_org`, `by_email_org`, `by_status`

---

### `usageRecords`
Tracks billable usage per org per billing period.

| Field | Type | Notes |
|-------|------|-------|
| orgId | Id<"organizations"> | |
| userId | string | |
| type | string | `'encounter'` \| `'companion'` \| `'document'` |
| billingPeriodStart | string | ISO date |

**Indexes:** `by_org_period`, `by_org_type_period`

---

### `organizationSetup`
Onboarding and feature setup tracking.

| Field | Type |
|-------|------|
| orgId | Id<"organizations"> |
| onboardingCompleted | boolean |
| locationSetupCompleted, teamSetupCompleted, billingSetupCompleted | boolean |

**Indexes:** `by_org`

---

### `userPreferences`
Per-user, per-org UI preferences (dismissed banners, tours, wizard state).

**Indexes:** `by_user_org`, `by_org`

---

## Clinical Data

### `vets`
Vet profile. One per Clerk user (legacy — most queries now go through memberships).

| Field | Type |
|-------|------|
| userId | string (Clerk) |
| name, email | string |
| orgId | Id<"organizations">? |
| specialties, license, practiceHours | optional |
| isActive | boolean |

**Indexes:** `by_org`

---

### `patients`
Patient (animal) records.

| Field | Type | Notes |
|-------|------|-------|
| name, species | string | |
| breed, dateOfBirth, age, weight, weightUnit, sex | string? | |
| ownerName, ownerEmail, ownerPhone | string? | |
| providerId | string | Attribution |
| orgId | Id<"organizations">? | |
| locationId | Id<"locations">? | |
| isActive | boolean | |
| medicalHistory | array | `{ date, type, notes, diagnosis?, treatment?, medications? }` |
| labResults | array? | `{ date, testName, results, notes? }` |
| vaccinations | array? | `{ name, date, nextDueDate }` |

**Indexes:** `by_org`, `by_org_location`

---

### `encounters`
The central record. Links patient, vet, recording facts, generated documents, billing.

| Field | Type | Notes |
|-------|------|-------|
| patientId | Id<"patients"> | |
| providerId | string | |
| orgId | Id<"organizations">? | |
| locationId | Id<"locations">? | |
| date | string | |
| status | string? | `'draft'` \| `'in-progress'` \| `'review'` \| `'published'` |
| interactionId | string? | Corti interaction ID |
| facts | array? | `{ id, text, group }` — aggregated from recordings |
| transcription | string? | Raw transcript |
| physicalExam | object? | `{ temperature, weight, heartRate, respiratoryRate, notes }` |
| diagnosis, treatment, followUp | string? | Vet-entered fields |
| vetNotes | object? | `{ diagnosis, treatmentPlan }` |
| generatedDocuments | object? | 8 doc types (see Document Generation) |
| invoiceMetadata | object? | Snapshot at invoice time |
| factReconciliation | object? | Multi-recording conflict resolution |
| caseReasoning | object? | Differentials, tests, drug interactions, literature |
| diagnosisResult | object? | Legacy AI diagnosis (pre-Corti agent) |
| extractedPatientInfo | object? | Auto-filled from recording |
| companionSessionId | string? | |
| addenda | array? | Post-publish vet addenda |
| appointmentTime, reasonForVisit | string? | |

**Indexes:** `by_org`, `by_org_location`, `by_patient`, `by_status_org`, `by_patient_status`

---

### `recordings`
Individual recording segments within a encounter. A encounter can have multiple recordings.

| Field | Type | Notes |
|-------|------|-------|
| consultationId | Id<"encounters"> | |
| interactionId | string? | Corti interaction ID |
| duration | number? | Seconds |
| transcript | string? | |
| facts | array? | `{ id, text, group }` |
| phase | string? | `'history'` \| `'exam'` \| `'assessment'` \| `'follow-up'` |
| orderIndex | number? | |
| billingExtractionStatus | string? | `'processing'` \| `'completed'` \| `'failed'` |
| billingExtractionAt | number? | |
| billingItemsExtracted | number? | |

**Indexes:** `by_consultation`

---

### `evidenceFiles`
Uploaded files (lab PDFs, imaging, referral letters) attached to a encounter.

| Field | Type | Notes |
|-------|------|-------|
| consultationId | Id<"encounters"> | |
| storageId | Id<"_storage"> | Convex file storage |
| fileName, mimeType | string | |
| fileSize | number | bytes |
| category | string | `'lab-result'` \| `'imaging'` \| `'referral'` \| `'other'` |
| notes | string? | Manual vet notes |
| extractedFindings | array? | `{ id, text, group, confidence? }` |
| extractionStatus | string | `'pending'` \| `'processing'` \| `'completed'` \| `'failed'` |

**Indexes:** `by_consultation`

---

### `followUps`
Scheduled follow-up appointments.

| Field | Type |
|-------|------|
| consultationId | Id<"encounters"> |
| patientId | Id<"patients"> |
| providerId, orgId, locationId | attribution |
| scheduledDate, type, reason | string |
| status | `'pending'` \| `'completed'` \| `'cancelled'` |
| reminderSent | boolean |
| monitoringInstructions, warningSignsForOwner | array? |

**Indexes:** `by_patient`, `by_vet_status`, `by_scheduled_date`, `by_org_status`

---

## AI Features

### `companionSessions`
Owner Companion AI sessions. One per published encounter. Accessed via `accessToken` (no auth).

| Field | Type | Notes |
|-------|------|-------|
| consultationId | Id<"encounters"> | |
| accessToken | string | In public URL: `/companion/[accessToken]` |
| context | object | Full visit context (patient, diagnosis, meds, instructions, etc.) |
| isActive | boolean | |
| expiresAt | string | |
| messageCount | number | |
| cortiAgentId | string? | Reused across turns |
| cortiContextId | string? | Corti conversation memory |
| contextVersion | number? | Incremented on context updates |

**Indexes:** `by_access_token`, `by_consultation`, `by_patient`, `by_org`

---

### `caseReasoningSessions`
Persisted vet AI chat sessions. Can be standalone or linked to a encounter.

| Field | Type |
|-------|------|
| consultationId | Id<"encounters">? | Optional |
| providerId, orgId | attribution |
| cortiAgentId, cortiContextId | string? |
| messages | array — `{ id, role, content, isError?, createdAt }` |
| messageCount, lastMessageAt | tracking |

**Indexes:** `by_consultation`, `by_org`, `by_vet`

---

## Billing

### `billingCatalog`
Org's master price list. All prices in cents.

| Field | Type | Notes |
|-------|------|-------|
| orgId | Id<"organizations"> | |
| name | string | "CBC Panel" |
| code | string | "LAB-001" |
| category | string | `'exam'` \| `'procedure'` \| `'lab'` \| `'medication'` \| `'supply'` \| `'imaging'` \| `'hospitalization'` \| `'other'` |
| basePrice | number | cents (4500 = $45.00) |
| taxable | boolean | |
| isActive | boolean | Soft delete |

**Indexes:** `by_org`, `by_org_active`, `by_org_category`, `by_org_code`

---

### `billingItems`
Per-encounter billing line items. Two-phase: prospective (planned) and retrospective (actual).

| Field | Type | Notes |
|-------|------|-------|
| consultationId | Id<"encounters"> | |
| orgId | Id<"organizations"> | |
| catalogItemId | Id<"billingCatalog">? | Null for manual items |
| description | string | Snapshot at billing time |
| quantity | number | |
| unitPrice | number | cents, snapshot |
| taxable | boolean | snapshot |
| phase | string | `'prospective'` \| `'retrospective'` |
| recordingId | Id<"recordings">? | Which recording mentioned this |
| reconciliationStatus | string? | `'confirmed'` \| `'added'` \| `'cancelled'` \| `'modified'` |
| linkedItemId | Id<"billingItems">? | Links prospective ↔ retrospective |
| extractedFromFact | string? | Fact ID |
| manuallyAdded | boolean | |
| confidence | string? | `'high'` \| `'medium'` \| `'low'` |

**Indexes:** `by_consultation`, `by_consultation_phase`, `by_org`, `by_recording`

---

## System

### `errorLogs`
Debug logging from API routes and client errors.

| Field | Type | Notes |
|-------|------|-------|
| category | string | `'corti-stream'` \| `'corti-facts'` \| `'corti-document'` \| `'corti-agent'` \| `'websocket'` \| `'client-error'` \| `'other'` |
| severity | string | `'error'` \| `'warning'` \| `'info'` |
| message, stack? | string | |
| interactionId, endpoint, userId, orgId | context | |
| resolved | boolean | |

**Indexes:** `by_category`, `by_severity`, `by_interaction`, `by_created`

---

### `processedWebhookEvents`
Idempotency table for Stripe and Clerk webhooks.

| Field | Type |
|-------|------|
| eventId | string |
| source | `'stripe'` \| `'clerk'` |
| processedAt | string |

**Indexes:** `by_event_id`

---

### `analyticsEvents`
Internal product analytics (wizard funnels, feature usage).

**Indexes:** `by_event_type`, `by_org`, `by_timestamp`, `by_user`
