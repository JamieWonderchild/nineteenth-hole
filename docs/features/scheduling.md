# Scheduling

## Overview

The scheduling system provides a week-view calendar for managing patient appointments. Appointments can be linked to encounters when the clinician is ready to start a visit.

---

## Calendar UI

**Route:** `/schedule`

The calendar is a full-viewport week view:

- **Columns:** Monday–Sunday (current week by default, navigable with prev/next)
- **Time range:** 07:00–20:00
- **Slot height:** 48px per 30 minutes (96px per hour)
- **Current time:** Red dot + horizontal line shown in today's column
- **Auto-scroll:** On mount, the calendar scrolls to the current time

**Mobile:** Single-day view (one column at a time, swipeable).

---

## Creating Appointments

Click any empty time slot in the calendar to open the booking dialog.

The dialog pre-fills the time from the slot clicked (snapped to 30-minute intervals).

Fields:
- **Patient name** — free text with autocomplete from org patients
- **Date** — pre-filled from column
- **Time** — pre-filled from slot
- **Duration** — 15, 30, 45, 60 min (default 30)
- **Appointment type** — new-patient, follow-up, telehealth, procedure, other
- **Reason** — optional free text
- **Notes** — optional

---

## Appointment Actions

Click an existing appointment block to open the detail modal.

| Action | Effect |
|--------|--------|
| Start Encounter | Creates draft consultation, links appointment, navigates to encounter |
| View Patient | Opens patient detail page |
| No Show | Sets status to `no-show` |
| Cancel | Sets status to `cancelled` |

**Start Encounter flow:**
1. `createDraftConsultation` mutation creates the encounter record
2. `linkEncounter` mutation sets `appointment.encounterId` and `status: 'in-progress'`
3. Router navigates to the new encounter

---

## Data Model

```typescript
appointments: {
  orgId,
  providerId,
  locationId?,
  patientId?,          // Convex patient record (if linked)
  patientName,         // Display name (always present)
  scheduledDate,       // "YYYY-MM-DD"
  scheduledTime?,      // "HH:MM" (24h)
  duration?,           // minutes
  type,                // 'new-patient' | 'follow-up' | 'telehealth' | 'procedure' | 'other'
  reason?,
  notes?,
  status,              // 'scheduled' | 'in-progress' | 'completed' | 'no-show' | 'cancelled'
  encounterId?,        // set when encounter is started
  followUpId?,         // set if created from a follow-up
  createdAt,
  updatedAt,
}
```

**Indexes:**
- `by_org_date: ["orgId", "scheduledDate"]` — primary query for day/week views
- `by_provider_date: ["providerId", "scheduledDate"]`
- `by_patient: ["patientId"]`
- `by_org_status: ["orgId", "status"]` — for upcoming appointments query

---

## Convex API

| Function | Type | Purpose |
|----------|------|---------|
| `appointments.create` | mutation | Book a new appointment |
| `appointments.getByOrgAndDate` | query | Single-day fetch (sorted by time) |
| `appointments.getByOrgAndDateRange` | query | Week/range fetch |
| `appointments.getUpcomingByOrg` | query | Next N days of scheduled appointments |
| `appointments.updateStatus` | mutation | Change status |
| `appointments.linkEncounter` | mutation | Link appointment to started encounter |
| `appointments.cancel` | mutation | Cancel appointment |

---

## Home Page Integration

The home page shows upcoming appointments (next 7 days) via `getUpcomingByOrg`. Each upcoming appointment shows the patient name, appointment type, and scheduled time.
