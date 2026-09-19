# Liveprac

An iPad-docked hub for a massage therapist: a session timer that tracks
named body-work sections, and a preference log fed by client signals
(pressure requests, "loved this" / "not for me") so patterns build up per
client without breaking the flow of a session.

## Live at

**https://liveprac.netlify.app** — Netlify builds and deploys automatically on
every push to this branch. No login needed to view it; send the link to anyone.

Hosting config lives in `netlify.toml`: the SPA rewrite (so deep links like
`/session` work), and cache headers that keep `index.html` always revalidating
while letting the content-hashed assets cache forever. That header split
matters — serving stale HTML that points at asset filenames from an older
deploy renders a blank white page, which is exactly what went wrong on the
previous GitHub Pages setup.

To add it to an iPad home screen: open the URL in Safari → Share → "Add to
Home Screen". It launches full-screen via `public/manifest.json`.

## Status: Phase 1 scaffold

What's built and working now, no hardware required:

- **Session Builder** (`/build`) — create/edit named section sequences, each
  with a duration and a body zone (shown as a small highlighted-region icon).
  Ships with 30- and 50-minute generic Swedish-style defaults
  (`src/state/defaultTemplates.ts`) — replace these with Shelby's actual
  sequence.
- **Live Session** (`/session`) — the current section is a large depleting
  ring dial (`src/components/TimerDial.tsx`) with its body-zone diagram and
  a "+2 min" button for adding time on the fly. Total session time is a
  small ring tucked in the corner. "Up next" is always visible below the
  dial as a dimmed zone icon + name. Section changes cross-fade. A small
  pill shows the net pressure signal for the current section, computed live
  from the event log. "Edit Plan" lets Shelby adjust the sequence
  mid-session — it edits a per-session copy, not the saved template.
- **Ambient cues** (`src/components/AmbientGlow.tsx`) — a peripheral glow
  banner fires on a client preference signal or when a section's time is up.
  It's cleared by a tap, standing in for gaze detection (a camera pointed at
  an undressed client is a trust problem, so this isn't planned).
- **Client Log** (`/log`) — per-client history of preference events, with a
  "Copy note for CRM" button that formats a plain-text summary.
- **Remote simulator + game controller** — since there's no physical remote
  yet, the Live Session screen has test buttons that fire the same event
  shapes a real Bluetooth dial/button would (`src/lib/remote.ts`). There's
  also a "Use game controller" toggle (`src/lib/gamepad.ts`) that reads a
  connected gamepad via the Gamepad API: left stick up/down maps to
  pressure, held longer for a bigger nudge (short/medium/long ≈ small/
  medium/large rotation, since a stick can't really "rotate"); button A/
  Cross taps to flag, holds to mark loved. **This is a first guess at how
  rotation-amount should map to pressure delta — not a finalized spec** —
  react to how it feels and we'll retune the thresholds. Note: Gamepad API
  support is solid on desktop Chrome/Firefox but inconsistent on iOS
  Safari, so test the controller on a laptop even though the app itself
  targets iPad. Delete both test panels once real hardware exists; nothing
  else needs to change.

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

Data (templates, clients, preference events) persists to `localStorage` —
fine for a single kiosk iPad, not for syncing across devices. Note that an
iPad home-screen web app keeps its own storage, separate from Safari tabs.

If the app ever fails to load, `index.html` prints the reason on screen
(inline styles + an error handler, since there's no usable dev console on an
iPad) rather than showing a blank page.

## Next steps

1. Try the live link on an actual iPad — give feedback on layout, dial sizes,
   and what should be removed to streamline further.
2. Sit down with Shelby and replace the default templates with her real
   section sequence and per-section timing.
3. Pick and buy remote hardware (Flic 2 or similar), wrap this app in
   Capacitor, and implement `RemoteController` for real.
4. Spotify + CRM export, once the above is validated in real sessions.
