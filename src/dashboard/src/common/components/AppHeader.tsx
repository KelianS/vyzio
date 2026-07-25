import { Link, useLocation } from 'react-router-dom'
import './AppHeader.css'

const NAV_ITEMS = [
  { path: '/', label: 'Accueil' },
  { path: '/cameras', label: 'Caméras' },
  { path: '/profiles', label: 'Profils' },
  { path: '/notifications', label: 'Alertes' },
  { path: '/history', label: 'Historique' },
  { path: '/expert', label: 'Expert' },
]

export function AppHeader() {
  const location = useLocation()

  return (
    <header className="app-header">
      <Link className="app-header-brand" to="/">
        Vyzio
      </Link>
      <nav className="app-header-nav" aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            className={`app-header-nav-link${location.pathname === item.path ? ' active' : ''}`}
            to={item.path}
            aria-current={location.pathname === item.path ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
