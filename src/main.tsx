import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AppStateProvider } from './state/AppStateContext'

// HashRouter (not BrowserRouter) because this is hosted on GitHub Pages as a
// static site with no server-side rewrite for client-side routes.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </HashRouter>
  </StrictMode>,
)
