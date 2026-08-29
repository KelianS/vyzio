import { useParams } from 'react-router'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { useUnsavedChanges } from '../Navigation/useUnsavedChanges'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useSurveillanceRefresh } from '../Surveillance/useSurveillanceRefresh'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { DetectionConfig } from '../../domain/entities/DetectionConfig'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { HelpPanel } from '../../common/settings/HelpPanel'
import {
  DETECTION_DRAFT_LABELS,
  buildDetectionSettings,
  type DetectionUpdate,
} from './cameraDetectionSettings'

export function CameraDetectionPage() {
  const { cameraId } = useParams()
  const { cameras: container } = useAppContainer()

  const config = useAsync(() => container.getCameraDetectionConfig.execute(cameraId!), [cameraId])
  const labels = useAsync(() => container.getCameraLabels.execute(), [])

  if (config.loading || labels.loading) {
    return <SettingsPage>Chargement…</SettingsPage>
  }
  if (!config.data || !labels.data) return null

  return (
    <DetectionForm
      cameraId={cameraId!}
      config={config.data}
      allLabels={labels.data}
      reload={config.reload}
    />
  )
}

function DetectionForm({
  cameraId,
  config,
  allLabels,
  reload,
}: {
  cameraId: string
  config: DetectionConfig
  allLabels: DetectionLabel[]
  reload: () => void
}) {
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()
  const refreshSurveillance = useSurveillanceRefresh()

  const draft = useSettingsDraft<DetectionUpdate>({
    saved: {
      labels: config.labels,
      motionSensitivity: config.motionSensitivity,
      motionSensitivityPinned: config.motionSensitivityPinned,
      detectStreamId: config.detectStreamId,
    },
    labels: DETECTION_DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  const saving = useAsyncAction(
    async () =>
      container.saveCameraDetectionConfig.execute(cameraId, {
        ...draft.values,
        // Inchangees ici : elles se reglent sur la page Conservation.
        continuousDaysOverride: config.retention.continuous.override,
        motionDaysOverride: config.retention.motion.override,
        eventClipDaysOverride: config.retention.eventClip.override,
      }),
    {
      onSuccess: () => {
        draft.accept()
        toast('Réglages de détection enregistrés.', 'success')
        refreshSurveillance()
        reload()
      },
    },
  )

  const declarations = buildDetectionSettings({
    config,
    allLabels,
    values: draft.values,
    set: draft.set,
  })

  return (
    <>
      <SettingsPage lede="Ce que cette caméra cherche, et avec quelle image.">
        <SettingsList settings={declarations} />

        <HelpPanel title="Quelle image faut-il faire analyser ?">
          {config.streams.length > 1 ? (
            <>
              <p>
                Sur une caméra de surveillance large — jardin, garage, allée — où vous voulez
                seulement savoir que quelqu’un est passé, gardez l’image la plus légère : c’est le
                réglage livré, vous n’avez rien à faire. Sur une caméra où vous voulez reconnaître
                les gens — entrée, couloir, salon — préférez la plus détaillée, surtout si les
                visages y apparaissent à plusieurs mètres.
              </p>
              <p>
                Si Vyzio devient lent et que les caméras saccadent, vérifiez qu’aucune n’est restée
                sur son image la plus détaillée.
              </p>
              <p>
                Certaines caméras annoncent leurs images sans en donner les dimensions : Vyzio
                affiche alors « Flux principal » ou « Flux secondaire » plutôt qu’un chiffre faux.
                Le choix reste possible, seule la taille manque.
              </p>
            </>
          ) : (
            <p>
              Cette caméra n’annonce qu’une seule image : il n’y a rien à arbitrer. Beaucoup de
              modèles en diffusent deux — une détaillée, une allégée — et Vyzio laisse alors choisir
              laquelle analyser. Si vous pensez que c’est le cas, relancez sa vérification depuis
              l’écran <em>Connexion</em> : il en profite pour lui redemander ce qu’elle sait
              diffuser.
            </p>
          )}
        </HelpPanel>

        <HelpPanel title="Pourquoi la sensibilité met-elle du temps à s’ajuster ?">
          <p>
            En automatique, Vyzio observe une caméra pendant au moins une douzaine d’heures avant de
            changer quoi que ce soit : c’est ce qui l’empêche de confondre une nuit calme avec une
            scène paisible. Ne rien voir bouger le premier jour est donc normal, et il ne descend
            jamais en dessous de <em>Réduite</em> — l’objectif est de garder le système fluide, pas
            d’aveugler une caméra.
          </p>
          <p>
            Si une caméra rate des choses, passez-la en <em>Élevée</em>. Si cela ne suffit pas, le
            sujet est trop petit ou trop peu contrasté dans l’image : c’est affaire de cadrage ou
            d’image analysée, plus de sensibilité.
          </p>
        </HelpPanel>
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={saving.loading}
        onSave={() => void saving.run()}
        onDiscard={draft.discard}
      />
    </>
  )
}
