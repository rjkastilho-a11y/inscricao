import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/sentry'
import './index.css'
import App from './App.tsx'

window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('vite-preload-reload')) {
    sessionStorage.setItem('vite-preload-reload', '1')
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
