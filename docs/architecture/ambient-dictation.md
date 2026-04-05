# Ambient vs Dictation Modes

## Overview

The platform supports two distinct recording modes, powered by two different Corti endpoints. They are not interchangeable — each serves a different clinical workflow.

---

## Ambient Consultation

**When to use:** Doctor–patient consultation. Both voices in the room.

**Corti endpoint:** `POST /api/corti/stream` → Corti `/stream`

**Implementation:** `CortiConsultation` component

**Behaviour:**
- Full multi-speaker dialogue captured
- Real-time transcription of both doctor and patient
- Extracts facts from the full clinical conversation (symptoms, exam findings, lab values, plan)
- Lab values spoken aloud are extracted as structured results
- Produces SOAP note, referral letters, patient summary from a single recording

**Start flow:** New Encounter → Ambient Consultation → Record

---

## Dictation Mode

**When to use:** Provider dictating solo — no patient present. Adding a note after the fact, billing entry, addenda.

**Corti endpoint:** `POST /api/corti/transcribe` → Corti `/transcribe`

**Implementation:** `useDictation` hook + `dictationCommands` lib

**Behaviour:**
- Single-speaker transcription
- Supports voice commands for navigation and editing
- Used for: billing notes, post-encounter addenda, dictated SOAP sections
- `updateAddendum` mutation saves dictated text back to the encounter

**Start flow:** Encounter detail → Dictate (header button)

---

## Why Two Endpoints

| | Ambient (`/stream`) | Dictation (`/transcribe`) |
|---|---|---|
| Speakers | Multi (doctor + patient) | Single (provider only) |
| Real-time | Yes | Yes |
| Fact extraction | Full clinical facts | Basic |
| Lab extraction | Yes | No |
| Voice commands | No | Yes |
| Use case | Consultation | Solo dictation / addenda |

**Never use `/transcribe` for ambient consultations.** The single-speaker model degrades fact extraction quality on multi-speaker audio.

**Never use `/stream` for dictation notes.** The multi-speaker model is not designed for solo dictation.

---

## Mode Selection UI

On the New Encounter screen, the mode picker presents two cards:

- **Ambient Consultation** — *Full doctor–patient dialogue*
- **Dictate Note** — *Single-speaker note*

Existing encounters show the mode as a read-only label. The header shows separate **Ambient** and **Dictate** buttons in the encounter detail view.

---

## Note → Facts Pipeline (Dictation)

When a dictated note is saved:
1. Text is stored as `encounter.dictationNote`
2. Background pipeline: `POST /api/corti/extract-facts-from-note`
3. Corti agent extracts structured facts from the dictated text
4. Facts merged into `encounter.facts` alongside any ambient facts

This allows dictated encounters to participate in ICD-10 coding and document generation the same way ambient encounters do.
