import { SettingRow } from './setting_row'
import type { SettingDeclaration } from './setting_declaration'

/**
 * A list of declared settings, drawn as one grouped surface. The separator between rows comes
 * from here, not from each row: that is what guarantees a settings page reads as a regular
 * table, whatever the rows contain.
 */
export function SettingsList({ settings }: { settings: readonly SettingDeclaration[] }) {
  return (
    <div className="divide-y divide-border rounded-card bg-card px-4">
      {settings.map((setting) => (
        <SettingRow key={setting.id} setting={setting} />
      ))}
    </div>
  )
}
