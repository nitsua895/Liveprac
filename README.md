# Liveprac

An iPad-docked hub for a massage therapist: a session timer that tracks
named body-work sections, and a preference log fed by client signals
(pressure requests, "loved this" / "not for me") so patterns build up per
client without breaking the flow of a session.

## Status: Phase 1 scaffold

What's built and working now, no hardware required:

- **Session Builder** (`/build`) — create/edit named section sequences with
  per-section durations. Ships with generic 30- and 60-minute Swedish-style
  defaults (`src/state/defaultTemplates.ts`) — replace these with Shelby's
  actual sequence.
- **Live Session** (`/session`) — big current-section timer, overall session
  countdown (goes red/over if she runs long), section timeline strip, and
  Back/Pause/Next/End controls.
- **Ambient cues** (`src/components/AmbientGlow.tsx`) — a peripheral glow
  banner fires on a client preference signal or when a section's time is up.
  It's cleared by a tap, standing in for gaze detection (a camera pointed at
  an undressed client is a trust problem, so this isn't planned).
- **Client Log** (`/log`) — per-client history of preference events, with a
  "Copy note for CRM" button that formats a plain-text summary.
- **Remote simulator** — since there's no physical remote yet, the Live
  Session screen has test buttons that fire the same event shapes a real
  Bluetooth dial/button would (`src/lib/remote.ts`). Delete this panel once
  hardware exists; nothing else needs to change.

## Deliberately stubbed (see `/settings`)

- **Bluetooth remote** (`src/lib/remote.ts`) — iOS Safari doesn't support
  Web Bluetooth, so a browser page can't pair with hardware directly. This
  needs a native wrapper (Capacitor + a BLE plugin) once a dial/button
  device is chosen. Flic 2 is the leading candidate: it natively
  distinguishes click / double-click / long-press and has an iOS SDK.
- **Spotify** (`src/lib/spotify.ts`) — feasible client-side via Spotify's
  PKCE auth flow + Web Playback SDK, no backend needed. Not wired up.
  Kept deliberately static/low-contrast in the UI so it never competes with
  the ambient glow cues for attention.
- **ClinicSense / MassageBook** (`src/lib/crm.ts`) — neither publishes a
  public API for third-party apps. No live sync; the Client Log's copy
  button is the bridge until/unless that changes.

## Running it

```bash
npm install
npm run dev       # opens on localhost; use --host to test on the iPad over LAN
npm run build     # typecheck + production build
npm run lint
```

To try it as a docked app on an iPad: open the dev/deployed URL in Safari,
share → "Add to Home Screen". `public/manifest.json` and the meta tags in
`index.html` make it launch full-screen without browser chrome.

Data (templates, clients, preference events) persists to `localStorage` —
fine for a single kiosk iPad, not for syncing across devices.

## Next steps

1. Sit down with Shelby and replace the default templates with her real
   section sequence and per-section timing.
2. Pick and buy remote hardware (Flic 2 or similar), wrap this app in
   Capacitor, and implement `RemoteController` for real.
3. Spotify + CRM export, once the above is validated in real sessions.
