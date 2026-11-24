import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './data/auth'
import { applyLogoTheme } from './lib/theme'
import { registerServiceWorker } from './lib/push'
import { startNotifications } from './lib/notify'
import './styles.css'

applyLogoTheme()
registerServiceWorker()
startNotifications()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
