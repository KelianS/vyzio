import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No dark-theme sync: tried on 2026-08-03, several surfaces stayed unreadable, and the
// tokens have to be finished before the class is put back on <html> (ADR-42).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
