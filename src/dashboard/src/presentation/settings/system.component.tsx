import { ChevronRight, Wrench } from 'lucide-react'
import { SettingsPage } from '../../common/settings/settings_page'
import { AdvancedFold } from '../../common/settings/advanced_fold'
import { SecondaryButton } from '../../common/components/secondary_button'
import { Loading } from '../../common/components/loading'
import { useRootStore } from '../../infrastructure/store/root.store'
import { SystemMonitorPanel } from './components/system_monitor_panel'

/** The hardware detection runs on and the state of surveillance, to read only (UI-35); the engine's technical UI stays a fallback (UI-09, principle #2). */
export function SystemView() {
  // Polled by the shell for every screen (ADR-02): this page reads it, never on its own.
  const systemStats = useRootStore((s) => s.systemStats)
  const cameras = useRootStore((s) => s.cameras)

  return (
    <SettingsPage>
      {systemStats ? <SystemMonitorPanel stats={systemStats} cameras={cameras} /> : <Loading />}
      <AdvancedFold lede="Une interface technique donne accès au détail brut de la surveillance. Elle n’est pas nécessaire à l’usage courant, et ce qu’on y modifie n’est pas repris par Vyzio.">
        <SecondaryButton icon={Wrench} to="/settings/hardware/advanced">
          Ouvrir l’interface technique
          <ChevronRight aria-hidden="true" />
        </SecondaryButton>
      </AdvancedFold>
    </SettingsPage>
  )
}
