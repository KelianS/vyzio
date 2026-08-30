// A class on <html> rather than the media query alone (ADR-42): makes an explicit choice possible later.
// Not called from main.tsx yet: tried on 2026-08-03, several surfaces stayed unreadable in dark.

const DARK_CLASS = 'dark'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function apply(dark: boolean) {
  document.documentElement.classList.toggle(DARK_CLASS, dark)
}

/** Aligns the theme on the system preference and keeps it aligned; returns how to stop listening. */
export function startThemeSync(): () => void {
  const query = window.matchMedia(DARK_QUERY)
  apply(query.matches)

  const onChange = (event: MediaQueryListEvent) => apply(event.matches)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
