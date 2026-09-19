import { Navigate, Route, Routes } from 'react-router-dom'
import { HubShell } from './components/HubShell'
import { ClientLog } from './screens/ClientLog'
import { Hub } from './screens/Hub'
import { LiveSession } from './screens/LiveSession'
import { Settings } from './screens/Settings'
import { SessionBuilder } from './screens/SessionBuilder'

function App() {
  return (
    <Routes>
      <Route element={<HubShell />}>
        <Route index element={<Hub />} />
        <Route path="build" element={<SessionBuilder />} />
        <Route path="session" element={<LiveSession />} />
        <Route path="log" element={<ClientLog />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
