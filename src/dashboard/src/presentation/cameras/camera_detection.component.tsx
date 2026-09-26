import { useEffect, useReducer } from 'react'
import { useParams } from 'react-router'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { DetectionConfig } from '../../domain/entities/detection_config.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import { SettingsPage } from '../../common/settings/settings_page'
import { HelpPanel } from '../../common/components/help_panel'
import { ReadFailure } from '../../common/components/error_message'
import {
  DETECTION_DRAFT_LABELS,
  buildDetectionSettings,
  type DetectionUpdate,
} from './camera_detection_settings'
import { buildCameraDetectionPresenter } from './camera_detection.presenter'
import { cameraDetectionReducer } from './camera_detection.reducer'
import { buildInitialCameraDetectionUido } from './camera_detection.uido'

export function CameraDetectionView() {
  const { cameraId } = useParams()
  const { cameras: container, hub: hubContainer } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(
    cameraDetectionReducer,
    undefined,
    buildInitialCameraDetectionUido,
  )
  const presenter = usePresenter(buildCameraDetectionPresenter, {
    container,
    hubContainer,
    dispatch,
    toast,
  })

  useEffect(() => {
    presenter.onLoad(cameraId!)
  }, [presenter, cameraId])

  if (uido.loading) return <SettingsPage>Chargement…</SettingsPage>
  if (uido.error)
    return (
      <SettingsPage>
        <ReadFailure error={uido.error} onRetry={() => presenter.onLoad(cameraId!)} />
      </SettingsPage>
    )
  if (!uido.config) return null
  const config = uido.config

  return (
    <DetectionForm
      config={config}
      allLabels={uido.labels}
      saving={uido.saving}
      onSave={(values) => presenter.onSave(cameraId!, config, values)}
    />
  )
}

function DetectionForm({
  config,
  allLabels,
  saving,
  onSave,
}: {
  config: DetectionConfig
  allLabels: DetectionLabel[]
  saving: boolean
  onSave: (values: DetectionUpdate) => Promise<boolean>
}) {
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
        saving={saving}
        onSave={async () => {
          if (await onSave(draft.values)) draft.accept()
        }}
        onDiscard={draft.discard}
      />
    </>
  )
}
