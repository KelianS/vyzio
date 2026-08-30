import { SettingRow } from './SettingRow'
import type { SettingDeclaration } from './settingDeclaration'

/**
 * A list of declared settings. The separator between rows comes from here, not
 * from each row: that is what guarantees a settings page reads as a regular
 * table, whatever the rows contain.
 */
export function SettingsList({ settings }: { settings: readonly SettingDeclaration[] }) {
  return (
    <div className="divide-y divide-border">
      {settings.map((setting) => (
        <SettingRow key={setting.id} setting={setting} />
      ))}
    </div>
  )
}
