# Liveprac product source of truth

Last updated: 2026-09-21

This document is the durable product reference for human contributors and AI coding agents. GitHub Issues describe executable work; this file defines why the product exists, the behavioral rules that must not regress, and the order of priorities. When an issue or implementation conflicts with this document, resolve the conflict explicitly before merging.

## Product promise

Liveprac is a calm, hands-free session conductor for massage practitioners. It reduces mental load during treatment, makes client feedback visible without disrupting touch, and turns what happened during a session into useful context for the next visit.

The app is not trying to become a complete scheduling, payments, insurance, or medical-record system.

## Primary use environment

- Flagship: iPad in landscape, viewed from several feet away in a dark room.
- Fully supported: iPad portrait, mobile portrait and landscape, and desktop.
- The practitioner may have occupied hands. Automatic behavior is the default; controls are overrides.
- The interface should remain calm while making time-sensitive feedback unmistakable in peripheral vision.

## Non-negotiable session rules

1. The appointment clock is the source of truth. Once started, its end time never moves.
2. Skips, backtracking, and section time adjustments redistribute the remaining appointment; they do not change the appointment deadline.
3. Sections advance automatically. A practitioner can override with minimal controls.
4. The session must recover correctly after refresh or foreground/background transitions.
5. Client cues never require dismissal. They hold long enough to notice, then fade; their event remains recorded.
6. The timeline shows sections and time allocation without decorative body icons. The active zone icon belongs in the dial.
7. Spotify is a compact control and handoff surface, not a Spotify replacement.
8. Touch targets, contrast, and essential type must work from a distance and across orientations.

## Current priority

Shelby will use Liveprac in real sessions during the week of 2026-09-21. Austin is also testing the physical remote beginning this week. Field reliability and legibility outrank feature breadth.

### P0 — field test and confidence

- Show the fixed `Ends <time>` value beside the session identity.
- Validate the Bluetooth/HID remote and capture the actual mappings and battery behavior on iPad.
- Validate exact appointment completion, reload recovery, screen wake behavior, sounds, and cues in real sessions.
- Record confusion, manual corrections, missed signals, and device/orientation failures as GitHub Issues.

### P1 — pre-session launchpad and client continuity

- Client name and relevant preferences.
- Previous session note.
- Planned focus areas.
- Contraindication reminders.
- Temperature preference.
- Zone-level pressure tendencies averaged per session.
- Remote connection/battery, wake-lock, and cue readiness.
- One explicit Start session action.

### P2 — complete the core loop

- Ensure every completed session has a durable record, even when no feedback event occurred.
- Post-session summary of plan versus actual allocation, cues, and notes.
- Suggested adjustments for the next routine, always approved by the practitioner.
- Faster routine duplication and editing.

### P3 — commercial MVP

- Secure accounts, cloud sync, backups, privacy controls, export, and deletion.
- Guided onboarding, error reporting, support path, and billing.
- Lightweight client history; avoid building a full EHR.

### P4 — differentiation and growth

- Client-facing remote or discreet feedback surface.
- Calendar/practice-management integrations.
- Team templates and clinic accounts.
- Trends that are actionable during preparation, not analytics for their own sake.

## Preference interpretation

- Pressure is calculated by body zone.
- First calculate the net request for a zone within each session, then average those session-level values over time. This prevents one long or button-heavy visit from overwhelming the client's broader history.
- Positive values mean a tendency toward more pressure; negative values mean less.
- Show the number of observed sessions so the practitioner can distinguish a weak signal from an established preference.
- Temperature is currently a simple explicit preference: cooler, neutral, or warmer. Do not infer it from unrelated events.

## Backlog discipline

- Product rules and priority order live here.
- Work items, acceptance criteria, bugs, and field feedback live in GitHub Issues.
- Code changes land through pull requests and reference their issue when one exists.
- Do not duplicate competing roadmaps in chat transcripts, README sections, or agent instruction files.
- Update this document when a product decision changes, in the same pull request as the implementation when possible.

## Current release gate

The field-test milestone is complete after ten real sessions without a timing, recovery, orientation, or input failure. Visual polish alone does not satisfy the gate.
