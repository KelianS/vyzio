import { SettingRow } from './SettingRow'
import type { SettingDeclaration } from './settingDeclaration'

/**
 * Une liste de reglages declares. Le separateur entre lignes vient d'ici, pas
 * de chaque ligne : c'est ce qui garantit qu'une page de reglages se lit comme
 * un tableau regulier, quel que soit le contenu des lignes.
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
