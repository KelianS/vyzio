import { useState } from 'react'
import { SettingsPage } from '../../common/settings/settings_page'
import { AdvancedFold } from '../../common/settings/advanced'
import { Loading } from '../../common/components/loading'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import { SystemMonitorPanel } from './components/system_monitor_panel'
import { TechnicalInterface } from './components/technical_interface'

/** The hardware detection runs on and the state of surveillance, to read only (UI-35); the engine's technical UI stays a fallback (UI-09, principle #2). */
export function SystemView() {
  // Polled by the shell for every screen (ADR-02): this page reads it, never on its own.
  const systemStats = useRootStore((s) => s.systemStats)
  const cameras = useRootStore((s) => s.cameras)
  const { frigateBaseUrl } = useAppContainer()
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <SettingsPage>
      {systemStats ? (
        <SystemMonitorPanel
          stats={systemStats}
          cameras={cameras}
          onDiagnose={() => setAdvancedOpen(true)}
        />
      ) : (
        <Loading />
      )}
      <AdvancedFold
        subtitle="Interface technique, ce qu’on y modifie n’est pas repris par Vyzio"
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
      >
        <TechnicalInterface frigateBaseUrl={frigateBaseUrl} />
      </AdvancedFold>
    </SettingsPage>
  )
}
