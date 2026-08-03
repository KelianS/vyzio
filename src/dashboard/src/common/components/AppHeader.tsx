import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { cn } from '../ui/utils'

/**
 * Barre principale (ADR-40). Elle ne porte que la **consultation**, plus une
 * unique entree vers les reglages : un libelle doit dire la nature de l'ecran,
 * consulter ou regler, et les deux ne se melangent pas.
 *
 * Elle est **fermee par construction** — la place d'un reglage est dans
 * l'arborescence, jamais ici. Ajouter une entree est une decision, pas un
 * reflexe : c'est cette contrainte qui empeche de retrouver l'etat corrige.
 */
const CONSULTATION_ITEMS = [
  { path: '/', label: 'Accueil' },
  { path: '/history', label: 'Historique' },
]

const SETTINGS_ITEM = { path: '/settings', label: 'Réglages' }

function isActive(pathname: string, path: string) {
  return path === '/' ? pathname === '/' : pathname.startsWith(path)
}

// `trailing` is a slot, not a nav entry: it keeps the bar closed and dependency-free.
export function AppHeader({ trailing }: { trailing?: ReactNode }) {
  const { pathname } = useLocation()

  const linkClass = (active: boolean) =>
    cn(
      // Pilule : c'est un lien de navigation, pas un bouton d'action
      // (regle de forme du DESIGN SYSTEM).
      'inline-flex h-8 items-center rounded-full px-3 text-sm font-medium transition-colors',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current',
      active
        ? 'bg-surface-inverse-foreground/16 font-bold text-surface-inverse-foreground'
        : 'text-surface-inverse-foreground/60 hover:bg-surface-inverse-foreground/10 hover:text-surface-inverse-foreground',
    )

  return (
    <header
      className={cn(
        'sticky top-4 z-100 flex flex-wrap items-center gap-x-4 gap-y-1',
        'rounded-card bg-surface-inverse px-3 py-2.5 text-surface-inverse-foreground',
        'shadow-[0_8px_32px_rgba(24,32,29,0.18)]',
        'sm:h-13 sm:flex-nowrap sm:gap-8 sm:px-6 sm:py-0',
      )}
    >
      <Link className="shrink-0 font-serif text-xl tracking-tight" to="/">
        Vyzio
      </Link>

      <nav
        aria-label="Navigation principale"
        className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5"
      >
        {CONSULTATION_ITEMS.map((item) => {
          const active = isActive(pathname, item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={linkClass(active)}
            >
              {item.label}
            </Link>
          )
        })}

        <span className="mx-2 h-5 w-px shrink-0 bg-surface-inverse-foreground/20" aria-hidden />

        <Link
          to={SETTINGS_ITEM.path}
          aria-current={isActive(pathname, SETTINGS_ITEM.path) ? 'page' : undefined}
          className={linkClass(isActive(pathname, SETTINGS_ITEM.path))}
        >
          {SETTINGS_ITEM.label}
        </Link>
      </nav>

      {trailing}
    </header>
  )
}
