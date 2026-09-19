import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AppStateProvider } from './state/AppStateContext'
import { applyAccent, getStoredAccent } from './lib/theme'

applyAccent(getStoredAccent())

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
