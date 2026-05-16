import './AppHeader.css'

type AppView = 'hub' | 'cameras' | 'notifications' | 'profiles' | 'history' | 'expert'

const NAV_ITEMS: { view: AppView; label: string; hash: string }[] = [
  { view: 'hub', label: 'Accueil', hash: '#' },
  { view: 'cameras', label: 'Caméras', hash: '#cameras' },
  { view: 'profiles', label: 'Profils', hash: '#profiles' },
  { view: 'notifications', label: 'Alertes', hash: '#notifications' },
  { view: 'history', label: 'Historique', hash: '#history' },
  { view: 'expert', label: 'Expert', hash: '#expert' },
]

interface AppHeaderProps {
  currentView: AppView
}

export function AppHeader({ currentView }: AppHeaderProps) {
  return (
    <header className="app-header">
      <a className="app-header-brand" href="#">
        Vyzio
      </a>
      <nav className="app-header-nav" aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.view}
            className={`app-header-nav-link${currentView === item.view ? ' active' : ''}`}
            href={item.hash}
            aria-current={currentView === item.view ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
