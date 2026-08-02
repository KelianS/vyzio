import { SettingsList } from '../../common/settings/SettingsList'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { RecordingSettingsUpdate } from '../../domain/entities/RecordingSettings'
import {
  CONTINUOUS_DISK_WARNING,
  RETENTION_EXPLANATION,
  RETENTION_LABEL,
  RETENTION_ORDER,
  formatDays,
  type RetentionWindow,
} from '../../common/recording/retention'
import { SettingsPanel } from './SettingsPanel'

// La requete d'enregistrement est plate quand la lecture est groupee par fenetre :
// un seul endroit fait le pont entre les deux formes.
const FIELD_OF = {
  continuous: 'continuousDays',
  motion: 'motionDays',
  eventClip: 'eventClipDays',
} as const satisfies Record<RetentionWindow, keyof RecordingSettingsUpdate>

/**
 * Durees de conservation de l'installation (ADR-39), premier ecran ecrit dans la
 * grammaire des reglages (ADR-43) : chaque duree y est **declaree**, pas
 * dessinee.
 */
export function ConservationPage() {
  // Ces cas d'usage vivent encore dans le container « cameras », heritage de
  // l'endroit ou la section etait affichee. Ils rejoindront un container propre
  // a la reprise des ecrans de reglages.
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()
  const { data, loading, error, reload } = useAsync(
    () => container.getRecordingSettings.execute(),
    [],
  )

  const save = useAsyncAction(
    async (update: RecordingSettingsUpdate) => container.saveRecordingSettings.execute(update),
    {
      onSuccess: () => {
        toast('Durée de conservation enregistrée.', 'success')
        reload()
      },
    },
  )

  if (loading) return <SettingsPanel title="Conservation">Chargement…</SettingsPanel>
  if (error || !data) return null

  const settings = data

  function commit(window: RetentionWindow, days: number) {
    save.run({
      continuousDays: settings.continuous.days,
      motionDays: settings.motion.days,
      eventClipDays: settings.eventClip.days,
      [FIELD_OF[window]]: days,
    })
  }

  const declarations: SettingDeclaration[] = RETENTION_ORDER.map((window) => {
    const setting = settings[window]
    return {
      id: `retention-${window}`,
      label: RETENTION_LABEL[window],
      nature: { kind: 'number', unit: 'jours', min: 0, max: settings.maxDays },
      help: RETENTION_EXPLANATION[window],
      // Un cout reste visible sans geste supplementaire (ADR-43).
      consequence:
        window === 'continuous' && setting.days > 0 ? CONTINUOUS_DISK_WARNING : undefined,
      value: setting.days,
      onChange: (days) => commit(window, days as number),
      provenance: {
        // Un cran au-dessus de la camera : il n'y a pas de surcharge sur quoi
        // s'appuyer, se tenir sur la valeur livree *est* la suivre.
        following: setting.days === setting.default,
        fallbackLabel: formatDays(setting.default),
        revertLabel: 'Revenir à la valeur d’origine',
        onRevert: () => commit(window, setting.default),
      },
    }
  })

  return (
    <SettingsPanel
      title="Conservation"
      lede="Ces durées s’appliquent à toutes vos caméras. Une caméra peut s’en écarter depuis sa propre fiche, durée par durée."
    >
      <SettingsList settings={declarations} />
      <p className="mt-4 text-sm text-muted-foreground">
        Mettre 0 signifie que rien n’est conservé de cette nature.
      </p>
    </SettingsPanel>
  )
}
