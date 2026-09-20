import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AppStateProvider } from './state/AppStateContext'
import { applyAccent, getStoredAccent } from './lib/theme'
import { completeAuthFromUrl } from './lib/spotify'
import { completeAuthFromUrl as completeGoogleAuthFromUrl } from './lib/googleCalendar'
import { bluetoothRemote } from './lib/bluetoothRemote'
import { startBleDispatch } from './lib/bleMapping'
import { primeChime } from './lib/chime'
import { primeCueAudio } from './lib/cueSound'

applyAccent(getStoredAccent())
// Unlocks audio playback on the first tap anywhere, so the session-end chime
// isn't silently blocked by mobile autoplay restrictions hours later.
document.addEventListener('pointerdown', () => {
  void primeChime()
  void primeCueAudio()
}, { once: true })
// Translates raw BLE notifications into remote-control events app-wide, not
// just while the live session screen is mounted — the connection is meant
// to hold across an entire shift, not just one open tab of the app.
startBleDispatch()
// Fire-and-forget: reconnects to a previously-paired remote without asking
// again, if the browser still remembers it. Never blocks first paint.
void bluetoothRemote.tryAutoReconnect()

// Spotify and Google Calendar both send the browser back here with
// ?code=…; each checks its own stashed `state` before acting, so only the
// one that actually started this redirect will touch it.
async function boot() {
  try {
    await completeAuthFromUrl()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Spotify connection failed.')
  }
  try {
    await completeGoogleAuthFromUrl()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Google Calendar connection failed.')
  }
  // Neither handler recognized this code (e.g. a stale/duplicate reload) —
  // drop it so it isn't retried forever.
  if (new URLSearchParams(window.location.search).has('code')) {
    window.history.replaceState({}, '', window.location.pathname)
  }

// Real paths, not hash routes — netlify.toml rewrites every path to index.html.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
)

document.getElementById('boot')?.remove()
}
void boot()
