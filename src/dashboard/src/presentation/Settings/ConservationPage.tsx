import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { UnsavedChangesGuard } from '../../common/settings/UnsavedChangesGuard'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type {
  RecordingSettings,
  RecordingSettingsUpdate,
} from '../../domain/entities/RecordingSettings'
import type { SaveRecordingSettings } from '../../domain/usecases/SaveRecordingSettings'
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

const DRAFT_LABELS: Record<keyof RecordingSettingsUpdate, string> = {
  continuousDays: RETENTION_LABEL.continuous,
  motionDays: RETENTION_LABEL.motion,
  eventClipDays: RETENTION_LABEL.eventClip,
}

/**
 * Durees de conservation de l'installation (ADR-39), ecrite dans la grammaire
 * des reglages (ADR-43) et le cycle d'edition en deux temps (ADR-41).
 *
 * L'enregistrement a la sortie du champ livre avec ADR-39 disparait ici : il
 * etait le seul de son espece, et le brouillon rend le regroupement des
 * changements visible au lieu d'en faire un effet de bord.
 */
export function ConservationPage() {
  // Ces cas d'usage vivent encore dans le container « cameras », heritage de
  // l'endroit ou la section etait affichee. Ils rejoindront un container propre
  // a la reprise des ecrans de reglages.
  const { cameras: container } = useAppContainer()
  const { data, loading, error, reload } = useAsync(
    () => container.getRecordingSettings.execute(),
    [],
  )

  if (loading) return <SettingsPanel title="Conservation">Chargement…</SettingsPanel>
  if (error || !data) return null

  return <ConservationForm settings={data} reload={reload} save={container.saveRecordingSettings} />
}

function ConservationForm({
  settings,
  reload,
  save,
}: {
  settings: RecordingSettings
  reload: () => void
  save: SaveRecordingSettings
}) {
  const { toast } = useToast()

  const draft = useSettingsDraft<RecordingSettingsUpdate>({
    saved: {
      continuousDays: settings.continuous.days,
      motionDays: settings.motion.days,
      eventClipDays: settings.eventClip.days,
    },
    labels: DRAFT_LABELS,
  })

  const saving = useAsyncAction(async () => save.execute(draft.values), {
    onSuccess: () => {
      draft.accept()
      toast('Durées de conservation enregistrées.', 'success')
      reload()
    },
  })

  const declarations: SettingDeclaration[] = RETENTION_ORDER.map((window) => {
    const field = FIELD_OF[window]
    const current = draft.values[field]
    const shipped = settings[window].default

    return {
      id: `retention-${window}`,
      label: RETENTION_LABEL[window],
      nature: { kind: 'number', unit: 'jours', min: 0, max: settings.maxDays },
      help: RETENTION_EXPLANATION[window],
      // Un cout reste visible sans geste supplementaire (ADR-43).
      consequence: window === 'continuous' && current > 0 ? CONTINUOUS_DISK_WARNING : undefined,
      value: current,
      onChange: (days) => draft.set(field, days as number),
      provenance: {
        // Un cran au-dessus de la camera : il n'y a pas de surcharge sur quoi
        // s'appuyer, se tenir sur la valeur livree *est* la suivre.
        following: current === shipped,
        fallbackLabel: formatDays(shipped),
        revertLabel: 'Revenir à la valeur d’origine',
        onRevert: () => draft.set(field, shipped),
      },
    }
  })

  return (
    <>
      <UnsavedChangesGuard when={draft.dirty} />

      <SettingsPanel
        title="Conservation"
        lede="Ces durées s’appliquent à toutes vos caméras. Une caméra peut s’en écarter depuis sa propre fiche, durée par durée."
      >
        <SettingsList settings={declarations} />
        <p className="mt-4 text-sm text-muted-foreground">
          Mettre 0 signifie que rien n’est conservé de cette nature.
        </p>
      </SettingsPanel>

      <SettingsDraftBar
        changes={draft.changes}
        // La retention est ecrite dans la configuration du moteur : l'enregistrer
        // le redemarre. L'API dira elle-meme quels reglages l'exigent.
        interruptsMonitoring
        saving={saving.loading}
        onSave={() => void saving.run()}
        onDiscard={draft.discard}
      />
    </>
  )
}
