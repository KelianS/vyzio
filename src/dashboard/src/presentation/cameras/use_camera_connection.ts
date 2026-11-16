import { useEffect, useMemo, useReducer } from 'react'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { Camera } from '../../domain/entities/camera.entity'
import type { SupportedProtocol } from '../../domain/entities/camera_capability_binding.entity'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { buildCameraConnectionPresenter } from './camera_connection.presenter'
import { cameraConnectionReducer } from './camera_connection.reducer'
import { buildInitialCameraConnectionUido } from './camera_connection.uido'
import {
  ALL_PROTOCOLS,
  connectionValuesOf,
  protocolKey,
  sameBox,
  type ConnectionValues,
  type ProtocolKey,
  type ProtocolValues,
} from './camera_connection_values'

// Protocol names stay out of the draft bar, which every page shows alike (UI-02).
const PROTOCOL_DRAFT_LABELS = Object.fromEntries(
  ALL_PROTOCOLS.map((protocol) => [protocolKey(protocol), 'Protocoles']),
) as Record<ProtocolKey, string>

const DRAFT_LABELS: Record<keyof ConnectionValues, string> = {
  displayName: 'Nom',
  host: 'Adresse',
  username: 'Identifiant',
  password: 'Mot de passe',
  ...PROTOCOL_DRAFT_LABELS,
}

type ConnectionDeps = Pick<
  Parameters<typeof buildCameraConnectionPresenter>[0],
  'container' | 'hubContainer'
>

/** A camera's connection, read and drafted the same way by its Connexion page and its Avancé page. */
export function useCameraConnection(camera: Camera, { container, hubContainer }: ConnectionDeps) {
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(
    cameraConnectionReducer,
    undefined,
    buildInitialCameraConnectionUido,
  )
  const presenter = usePresenter(buildCameraConnectionPresenter, {
    container,
    hubContainer,
    dispatch,
    toast,
  })

  const cameraId = camera.id
  useEffect(() => {
    presenter.onLoad(cameraId)
  }, [presenter, cameraId])

  const saved = useMemo(() => connectionValuesOf(camera, uido.protocols), [camera, uido.protocols])
  const draft = useSettingsDraft<ConnectionValues>({ saved, labels: DRAFT_LABELS })

  useUnsavedChanges(draft.dirty)

  /** Back to its saved content, a box drops its edit, so a later re-read never mistakes it for a change. */
  function setProtocol(protocol: SupportedProtocol, patch: Partial<ProtocolValues>) {
    const key = protocolKey(protocol)
    const next = { ...draft.values[key], ...patch }
    if (sameBox(next, draft.saved[key])) draft.revert(key)
    else draft.set(key, next)
  }

  return { uido, presenter, draft, setProtocol }
}
