import { SettingsPage } from '../../common/settings/settings_page'
import { AdvancedRow } from '../../common/settings/advanced'
import { Loading } from '../../common/components/loading'
import { useRootStore } from '../../infrastructure/store/root.store'
import { SystemMonitorPanel } from './components/system_monitor_panel'
import { TECHNICAL_INTERFACE_PATH } from './hardware_paths'

/** The hardware detection runs on and the state of surveillance, to read only (UI-35); the engine's technical UI stays a fallback (UI-09, principle #2). */
export function SystemView() {
  // Polled by the shell for every screen (ADR-02): this page reads it, never on its own.
  const systemStats = useRootStore((s) => s.systemStats)
  const cameras = useRootStore((s) => s.cameras)

  return (
    <SettingsPage>
      {systemStats ? <SystemMonitorPanel stats={systemStats} cameras={cameras} /> : <Loading />}
      <AdvancedRow
        to={TECHNICAL_INTERFACE_PATH}
        subtitle="Interface technique, ce qu’on y modifie n’est pas repris par Vyzio"
      />
    </SettingsPage>
  )
}
