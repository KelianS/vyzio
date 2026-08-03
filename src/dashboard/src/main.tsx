import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// `startThemeSync()` (common/theme.ts) n'est volontairement pas appele ici :
// voir l'explication de sequencement dans ce fichier.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
