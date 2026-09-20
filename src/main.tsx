import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AppStateProvider } from './state/AppStateContext'
import { applyAccent, getStoredAccent } from './lib/theme'
import { completeAuthFromUrl } from './lib/spotify'
import { bluetoothRemote } from './lib/bluetoothRemote'
import { startBleDispatch } from './lib/bleMapping'

applyAccent(getStoredAccent())
// Translates raw BLE notifications into remote-control events app-wide, not
// just while the live session screen is mounted — the connection is meant
// to hold across an entire shift, not just one open tab of the app.
startBleDispatch()
// Fire-and-forget: reconnects to a previously-paired remote without asking
// again, if the browser still remembers it. Never blocks first paint.
void bluetoothRemote.tryAutoReconnect()

// Spotify sends the browser back here with ?code=…; swap it for a token.
async function boot() {
  try {
    await completeAuthFromUrl()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Spotify connection failed.')
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
