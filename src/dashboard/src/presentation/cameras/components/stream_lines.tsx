import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '../../../common/components/badge'
import { ConfirmModal } from '../../../common/components/confirm_modal'
import { DiagnosticLine, ReadFailure } from '../../../common/components/error_message'
import { HelpPanel } from '../../../common/components/help_panel'
import { HelpTrigger } from '../../../common/components/help_trigger'
import type { AppError } from '../../../common/errors/app_error'
import { scrubSecrets } from '../../../common/errors/scrub_secrets'
import { SettingRow } from '../../../common/settings/setting_row'
import type { SettingDeclaration } from '../../../common/settings/setting_declaration'
import { Button } from '../../../common/ui/button'
import { Input } from '../../../common/ui/input'
import type { StreamProtocol } from '../../../domain/entities/camera_capability_binding.entity'
import {
  StreamRole,
  type CameraStream,
  type CameraStreamAddition,
  type CameraStreamLineup,
} from '../../../domain/entities/camera_stream.entity'
import { DESTRUCTIVE_OUTLINE } from '../cameras.formatters'
import { StreamTask } from '../camera_connection.uido'
import type { ProtocolOption } from '../protocol_labels'
import {
  ASKS_STREAM_PATH,
  DVRIP_QUALITIES,
  RECORDING_STREAM_KEPT,
  ROLE_CONSEQUENCES,
  ROLE_LABELS,
  STREAM_FAILED,
  STREAM_LINE_PILLS,
  StreamLineState,
  roleOptions,
  streamLineState,
  streamQuality,
  streamReach,
} from '../stream_lines'
import { Picker } from './protocol_choice'

/** What the stream lines ask of their screen. */
export interface StreamLineIntents {
  onRetryRead: () => void
  onSetRole: (streamId: string, role: StreamRole) => void
  onSetEnabled: (streamId: string, enabled: boolean) => Promise<void>
  onRemove: (streamId: string) => Promise<void>
  onCheck: (streamId: string) => void
  onOpenForm: () => void
  onCloseForm: () => void
  onAdd: (addition: CameraStreamAddition) => void
}

/** One line per stream of the camera, in the stream card's Options (DESIGN SYSTEM § Capability cards, stream lines). */
export function StreamLines({
  lineup,
  loading,
  readError,
  protocols,
  mainPath,
  tasks,
  formOpen,
  adding,
  intents,
}: {
  lineup: CameraStreamLineup | null
  loading: boolean
  readError: AppError | null
  /** The camera's protocols that can carry a stream, for « Ajouter un flux ». */
  protocols: ProtocolOption[]
  /** The main stream's path, a declared setting that follows the page's draft (ADR-41). */
  mainPath: SettingDeclaration
  tasks: Partial<Record<string, StreamTask>>
  formOpen: boolean
  adding: boolean
  intents: StreamLineIntents
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-medium">Flux</h4>
      {loading && <p className="text-muted-foreground">Chargement…</p>}
      {readError && (
        <ReadFailure
          error={readError}
          onRetry={intents.onRetryRead}
          subject="Les flux de cette caméra n’ont pas pu être lus."
        />
      )}
      {lineup && (
        <ul aria-label="Flux" className="flex flex-col gap-3">
          {lineup.streams.map((stream, index) => (
            <StreamLine
              key={stream.id}
              stream={stream}
              lineup={lineup}
              // The lowest rank holds the path the user entered (ADR-65): shown once, as its setting.
              mainPath={index === 0 && ASKS_STREAM_PATH[stream.protocol] ? mainPath : null}
              task={tasks[stream.id]}
              intents={intents}
            />
          ))}
        </ul>
      )}
      {lineup && protocols.length > 0 && (
        <AddStream
          protocols={protocols}
          open={formOpen}
          adding={adding}
          onOpen={intents.onOpenForm}
          onClose={intents.onCloseForm}
          onAdd={intents.onAdd}
        />
      )}
      <HelpPanel title="Quel rôle donner à chaque flux ?">
        <p>
          Par défaut, le flux le plus détaillé enregistre et le plus léger est analysé : Vyzio
          réduit de toute façon l’image avant de l’analyser.
        </p>
        <p>
          Sur une caméra large, jardin, garage, allée, gardez le flux le plus léger en détection.
          Pour reconnaître les gens, entrée, couloir, salon, donnez la détection au flux le plus
          détaillé, surtout si les visages y apparaissent à plusieurs mètres. Si Vyzio devient lent,
          vérifiez qu’aucune caméra n’analyse son flux le plus détaillé sans raison.
        </p>
        <p>Un seul flux enregistre. Donner un rôle à un flux le retire à celui qui l’avait.</p>
        <p>
          Changer de protocole remplace la liste par le flux principal de ce protocole : Vyzio
          retrouve les autres flux à la vérification suivante, mais pas ceux ajoutés à la main.
        </p>
        <p>« Ajouter un flux » sert pour un flux que la caméra n’a pas signalé.</p>
      </HelpPanel>
    </div>
  )
}

function StreamLine({
  stream,
  lineup,
  mainPath,
  task,
  intents,
}: {
  stream: CameraStream
  lineup: CameraStreamLineup
  mainPath: SettingDeclaration | null
  task: StreamTask | undefined
  intents: StreamLineIntents
}) {
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const state = streamLineState(stream)
  const records = stream.id === lineup.recordStreamId
  const quality = streamQuality(stream)

  return (
    <li aria-label={quality} className="rounded-inset border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <p className="font-medium">{quality}</p>
          <HelpTrigger
            question="Comment Vyzio reçoit-il ce flux ?"
            help={streamReach(stream, mainPath !== null)}
          />
        </div>
        <Badge tone={STREAM_LINE_PILLS[state].tone}>{STREAM_LINE_PILLS[state].label}</Badge>
      </div>
      {mainPath && <SettingRow setting={mainPath} />}
      {state === StreamLineState.Failed && (
        <div className="text-sm text-destructive">
          <p>{STREAM_FAILED}</p>
          {stream.lastError && <DiagnosticLine text={scrubSecrets(stream.lastError)} />}
        </div>
      )}
      {stream.enabled && (
        <div className="mt-2 flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-1">
            <span id={`${stream.id}-role`} className="text-muted-foreground">
              Rôle
            </span>
            <HelpTrigger question="Que change ce rôle ?" help={ROLE_CONSEQUENCES[stream.role]} />
          </div>
          <Picker
            labelledBy={`${stream.id}-role`}
            value={stream.role}
            options={roleOptions(stream, lineup)}
            onChange={(value) => intents.onSetRole(stream.id, value as StreamRole)}
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {stream.enabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={task !== undefined}
            onClick={() => intents.onCheck(stream.id)}
          >
            {task === StreamTask.Check ? 'Vérification…' : 'Vérifier'}
          </Button>
        )}
        {stream.enabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={DESTRUCTIVE_OUTLINE}
            disabled={records || task !== undefined}
            onClick={() => setConfirmDisable(true)}
          >
            Désactiver
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={task !== undefined}
            onClick={() => void intents.onSetEnabled(stream.id, true)}
          >
            {task === StreamTask.Toggle ? 'Activation…' : 'Activer'}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={DESTRUCTIVE_OUTLINE}
          disabled={records || task !== undefined}
          onClick={() => setConfirmRemove(true)}
        >
          Supprimer
        </Button>
        {records && (
          <HelpTrigger
            question="Pourquoi ce flux ne peut-il pas être désactivé ?"
            help={RECORDING_STREAM_KEPT}
          />
        )}
      </div>

      {confirmDisable && (
        <ConfirmModal
          title="Désactiver ce flux ?"
          body="Vyzio cesse de s’en servir et de le vérifier. Il reste dans la liste."
          confirmLabel="Désactiver"
          tone="warn"
          loading={task === StreamTask.Toggle}
          onConfirm={async () => {
            await intents.onSetEnabled(stream.id, false)
            setConfirmDisable(false)
          }}
          onCancel={() => setConfirmDisable(false)}
        />
      )}
      {confirmRemove && (
        <ConfirmModal
          title="Supprimer ce flux ?"
          body="Il quitte la liste et ne revient pas de lui-même."
          confirmLabel="Supprimer"
          tone="danger"
          loading={task === StreamTask.Remove}
          onConfirm={async () => {
            await intents.onRemove(stream.id)
            setConfirmRemove(false)
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </li>
  )
}

function AddStream({
  protocols,
  open,
  adding,
  onOpen,
  onClose,
  onAdd,
}: {
  protocols: ProtocolOption[]
  open: boolean
  adding: boolean
  onOpen: () => void
  onClose: () => void
  onAdd: (addition: CameraStreamAddition) => void
}) {
  return open ? (
    <AddStreamForm protocols={protocols} adding={adding} onAdd={onAdd} onCancel={onClose} />
  ) : (
    <Button type="button" variant="outline" size="sm" className="self-start" onClick={onOpen}>
      <Plus aria-hidden="true" />
      Ajouter un flux
    </Button>
  )
}

function AddStreamForm({
  protocols,
  adding,
  onAdd,
  onCancel,
}: {
  protocols: ProtocolOption[]
  adding: boolean
  onAdd: (addition: CameraStreamAddition) => void
  onCancel: () => void
}) {
  const [protocol, setProtocol] = useState<StreamProtocol>(protocols[0].value as StreamProtocol)
  const [path, setPath] = useState('')
  const [quality, setQuality] = useState(DVRIP_QUALITIES[1].value)
  const [role, setRole] = useState<StreamRole>(StreamRole.None)
  const byPath = ASKS_STREAM_PATH[protocol]

  function add() {
    const secondary = DVRIP_QUALITIES.find((entry) => entry.value === quality)?.secondary ?? false
    onAdd({
      protocol,
      path: byPath ? path.trim() || null : null,
      role,
      secondary: !byPath && secondary,
    })
  }

  return (
    <div
      role="group"
      aria-label="Ajouter un flux"
      className="rounded-inset border border-border p-3"
    >
      <p className="font-medium">Ajouter un flux</p>
      <div className="mt-2 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Protocole</span>
          <Picker
            value={protocol}
            options={protocols}
            onChange={(value) => setProtocol(value as StreamProtocol)}
          />
        </label>
        {byPath ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Chemin du flux</span>
            <Input
              placeholder="/stream2"
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Qualité</span>
            <Picker value={quality} options={DVRIP_QUALITIES} onChange={setQuality} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Rôle</span>
          <Picker
            value={role}
            options={Object.values(StreamRole).map((value) => ({
              value,
              label: ROLE_LABELS[value],
            }))}
            onChange={(value) => setRole(value as StreamRole)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={adding} onClick={add}>
            {adding ? 'Vérification…' : 'Ajouter et vérifier'}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={adding} onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  )
}
