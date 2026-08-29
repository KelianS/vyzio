import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { useUnsavedChanges } from '../Navigation/useUnsavedChanges'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useSurveillanceRefresh } from '../Surveillance/useSurveillanceRefresh'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { Button } from '../../common/ui/button'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { Camera } from '../../domain/entities/Camera'
import { SettingsPage, SettingsSection } from '../../common/settings/SettingsPage'
import { HelpPanel } from '../../common/components/HelpPanel'
import { CapabilitySection } from './CapabilitySection'

interface ConnectionValues {
  displayName: string
  host: string
  port: number
  streamPath: string
  username: string
  password: string
}

const DRAFT_LABELS: Record<keyof ConnectionValues, string> = {
  displayName: 'Nom',
  host: 'Adresse',
  port: 'Port',
  streamPath: 'Chemin du flux',
  username: 'Identifiant',
  password: 'Mot de passe',
}

export function CameraConnectionPage() {
  const camera = useOutletContext<Camera>()

  return <ConnectionForm camera={camera} />
}

function ConnectionForm({ camera }: { camera: Camera }) {
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()
  const refreshSurveillance = useSurveillanceRefresh()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const draft = useSettingsDraft<ConnectionValues>({
    saved: {
      displayName: camera.displayName,
      host: camera.host,
      port: camera.port,
      streamPath: camera.streamPath ?? '',
      username: camera.username ?? '',
      password: '',
    },
    labels: DRAFT_LABELS,
  })

  function reloadCameras() {
    void useRootStore.getState().loadCameras(container.getCameras)
  }

  useUnsavedChanges(draft.dirty)

  const saving = useAsyncAction(
    async () =>
      container.updateCamera.execute(camera.id, {
        displayName: draft.values.displayName,
        host: draft.values.host,
        port: draft.values.port,
        streamPath: draft.values.streamPath.trim() || null,
        username: draft.values.username.trim() || null,
        // Empty means "leave unchanged", not "no password" — sending it blank would erase it.
        password: draft.values.password.trim() ? draft.values.password : null,
        vendorFamily: camera.vendorFamily,
        sourceType: camera.sourceType,
        streamProtocol: camera.streamProtocol,
        ptzSupported: camera.ptzSupported,
      }),
    {
      onSuccess: () => {
        draft.accept()
        toast('Connexion enregistrée.', 'success')
        refreshSurveillance()
        reloadCameras()
      },
    },
  )

  const verifying = useAsyncAction(async () => container.verifyCamera.execute(camera.id), {
    onSuccess: (status) => {
      toast(
        status?.connected ? 'Caméra joignable.' : 'Caméra injoignable — vérifiez ces réglages.',
        status?.connected ? 'success' : 'error',
      )
      reloadCameras()
    },
  })

  const deleting = useAsyncAction(async () => container.deleteCamera.execute(camera.id), {
    onSuccess: (result) => {
      toast(result?.message ?? 'Caméra supprimée.', 'info')
      reloadCameras()
      void navigate('/settings/cameras')
    },
  })

  const declarations: SettingDeclaration[] = [
    {
      id: 'connection-name',
      label: 'Nom',
      nature: { kind: 'text' },
      value: draft.values.displayName,
      onChange: (value) => draft.set('displayName', value as string),
    },
    {
      id: 'connection-host',
      label: 'Adresse',
      nature: { kind: 'text', placeholder: '192.168.1.50' },
      help: 'L’adresse de la caméra sur votre réseau local. Elle peut changer si votre box la réattribue.',
      value: draft.values.host,
      onChange: (value) => draft.set('host', value as string),
    },
    {
      id: 'connection-port',
      label: 'Port',
      nature: { kind: 'number', min: 1, max: 65535 },
      value: draft.values.port,
      onChange: (value) => draft.set('port', value as number),
    },
  ]

  // DVRIP derives the stream path from the protocol; asking for it makes no sense.
  if (camera.streamProtocol !== 'dvrip') {
    declarations.push({
      id: 'connection-stream-path',
      label: 'Chemin du flux',
      nature: { kind: 'text', placeholder: '/stream1' },
      help: 'Vyzio le demande à la caméra quand elle sait répondre. Ne le renseignez que si la caméra n’a pas été reconnue.',
      value: draft.values.streamPath,
      onChange: (value) => draft.set('streamPath', value as string),
    })
  }

  declarations.push(
    {
      id: 'connection-username',
      label: 'Identifiant',
      nature: { kind: 'text' },
      value: draft.values.username,
      onChange: (value) => draft.set('username', value as string),
    },
    {
      id: 'connection-password',
      label: 'Mot de passe',
      nature: { kind: 'secret', placeholder: 'Inchangé' },
      help: 'Laissez vide pour conserver le mot de passe actuel.',
      value: draft.values.password,
      onChange: (value) => draft.set('password', value as string),
    },
  )

  return (
    <>
      <SettingsPage lede="Comment Vyzio joint cette caméra.">
        <SettingsList settings={declarations} />

        {/* Verifier et supprimer sont des **actions** : elles agissent tout de
            suite et n'ont donc rien a faire dans le brouillon. */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={verifying.loading}
            onClick={() => void verifying.run()}
          >
            {verifying.loading ? 'Vérification…' : 'Vérifier la connexion'}
          </Button>
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Supprimer cette caméra
          </Button>
        </div>

        {/* Section non encore reprise : configurer une capacite est une **action**
            — elle teste une connexion et rend un resultat — pas une valeur. Elle
            ne rentre donc pas telle quelle dans le cycle de brouillon. */}
        <SettingsSection title="Capacités" lede="Ce que Vyzio a vérifié auprès de cette caméra.">
          <CapabilitySection camera={camera} />

          <HelpPanel title="Le test échoue, que vérifier ?">
            <p>
              Que la caméra est joignable sur le réseau, et que le port du protocole choisi est
              ouvert — <em>8899</em> pour ONVIF, <em>34567</em> pour DVRIP. Les identifiants sont
              ceux saisis à l’ajout de la caméra : s’ils ont changé sur la caméra, corrigez-les
              d’abord ci-dessus.
            </p>
            <p>
              Beaucoup de caméras parlent plusieurs protocoles — une ICSee répond souvent en DVRIP
              et en ONVIF. Si l’un échoue, essayez l’autre : une capacité dont le test échoue n’est
              jamais proposée comme active, et le test se relance à tout moment.
            </p>
            <p>
              Deux limites connues : sur les firmwares d’entrée de gamme, ONVIF répond parfois en
              plusieurs secondes, ce qui rend le pilotage précis difficile ; et l’orientation à
              l’écart, en vie privée, suppose que le PTZ soit déjà vérifié sur la même caméra.
            </p>
          </HelpPanel>
        </SettingsSection>
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={saving.loading}
        onSave={() => void saving.run()}
        onDiscard={draft.discard}
      />

      {confirmDelete && (
        <ConfirmModal
          title={`Supprimer « ${camera.displayName} » ?`}
          body="Vyzio cesse de surveiller cette caméra. Les enregistrements déjà faits ne sont pas effacés."
          confirmLabel="Supprimer"
          tone="danger"
          loading={deleting.loading}
          onConfirm={async () => {
            await deleting.run()
            setConfirmDelete(false)
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
