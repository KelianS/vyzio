import { SettingsPage } from '../../common/settings/settings_page'
import { AdvancedPage, AdvancedRow } from '../../common/settings/advanced'
import { SecondaryButton } from '../../common/components/secondary_button'
import { ChevronRight, Wrench } from 'lucide-react'
import { Loading } from '../../common/components/loading'
import { useRootStore } from '../../infrastructure/store/root.store'
import { SystemMonitorPanel } from './components/system_monitor_panel'
import { HARDWARE_ADVANCED_PATH, TECHNICAL_INTERFACE_PATH } from './hardware_paths'

/** The hardware detection runs on and the state of surveillance, to read only (UI-35); the engine's technical UI stays a fallback (UI-09, principle #2). */
export function SystemView() {
  // Polled by the shell for every screen (ADR-02): this page reads it, never on its own.
  const systemStats = useRootStore((s) => s.systemStats)
  const cameras = useRootStore((s) => s.cameras)

  return (
    <SettingsPage>
      {systemStats ? <SystemMonitorPanel stats={systemStats} cameras={cameras} /> : <Loading />}
      <AdvancedRow to={HARDWARE_ADVANCED_PATH} />
    </SettingsPage>
  )
}

/** The Avancé page of Matériel: the engine's technical interface, behind the line saying what it costs (UI-09). */
export function SystemAdvancedView() {
  return (
    <AdvancedPage lede="Une interface technique donne accès au détail brut de la surveillance. Elle n’est pas nécessaire à l’usage courant, et ce qu’on y modifie n’est pas repris par Vyzio.">
      <div>
        <SecondaryButton icon={Wrench} to={TECHNICAL_INTERFACE_PATH}>
          Ouvrir l’interface technique
          <ChevronRight aria-hidden="true" />
        </SecondaryButton>
      </div>
    </AdvancedPage>
  )
}
