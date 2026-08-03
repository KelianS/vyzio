// Classe sur <html> plutot que la seule requete media (ADR-42) : rend un choix explicite possible plus tard.
// Pas encore appele dans main.tsx : tente le 2026-08-03, plusieurs surfaces restaient illisibles en sombre.

const DARK_CLASS = 'dark'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function apply(dark: boolean) {
  document.documentElement.classList.toggle(DARK_CLASS, dark)
}

/** Aligne le theme sur la preference systeme et le maintient aligne ; renvoie de quoi arreter l'ecoute. */
export function startThemeSync(): () => void {
  const query = window.matchMedia(DARK_QUERY)
  apply(query.matches)

  const onChange = (event: MediaQueryListEvent) => apply(event.matches)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
