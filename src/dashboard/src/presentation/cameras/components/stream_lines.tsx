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
  type AvailableStream,
  type CameraStream,
  type CameraStreamAddition,
  type CameraStreamLineup,
} from '../../../domain/entities/camera_stream.entity'
import { DESTRUCTIVE_OUTLINE } from '../cameras.formatters'
import { StreamTask } from '../camera_connection.uido'
import type { ProtocolOption } from '../protocol_labels'
import {
  ASKS_STREAM_PATH,
  DETECTION_FALLS_BACK,
  OTHER_PATH,
  RECORDING_STREAM_KEPT,
  ROLE_CONSEQUENCES,
  ROLE_LABELS,
  STREAM_LINE_PILLS,
  StreamLineState,
  addChoices,
  choiceOfPath,
  choiceOptions,
  mainPathChoices,
  roleOptions,
  streamFailure,
  streamLineState,
  streamQuality,
  streamReach,
} from '../stream_lines'
import { Picker } from './protocol_choice'

/** What the stream lines ask of their screen. */
export interface StreamLineIntents {
  onRetryRead: () => void
  onSetRole: (streamId: string, role: StreamRole) => void
  onRemove: (streamId: string) => Promise<void>
  onCheck: (streamId: string) => void
  /** Asks the camera what it serves over a protocol, each time a stream dropdown or the add form opens. */
  onListAvailable: (protocol: StreamProtocol) => void
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
  available,
  availableErrors,
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
  /** What the camera serves, by protocol; absent while it is asked. */
  available: Partial<Record<StreamProtocol, AvailableStream[]>>
  availableErrors: Partial<Record<StreamProtocol, AppError>>
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
              available={available[stream.protocol]}
              availableError={availableErrors[stream.protocol]}
              task={tasks[stream.id]}
              intents={intents}
            />
          ))}
        </ul>
      )}
      {lineup && protocols.length > 0 && (
        <AddStream
          protocols={protocols}
          lineup={lineup}
          available={available}
          availableErrors={availableErrors}
          open={formOpen}
          adding={adding}
          intents={intents}
        />
      )}
      <HelpPanel title="Quel rôle donner à chaque flux ?">
        <p>
          Par défaut, le flux le plus détaillé enregistre et le plus léger est analysé : Vyzio
          réduit de toute façon l’image avant de l’analyser.
        </p>
        <p>
          Sur une caméra large, jardin, garage, allée, gardez le flux le plus léger en détection.
          Pour reconnaître les gens, entrée, couloir, salon, donnez « Enregistrement et détection »
          au flux le plus détaillé, surtout si les visages y apparaissent à plusieurs mètres. Si
          Vyzio devient lent, vérifiez qu’aucune caméra n’analyse son flux le plus détaillé sans
          raison.
        </p>
        <p>
          Un seul flux enregistre. Donner un rôle à un flux le retire à celui qui l’avait. Un flux
          gardé sans servir a le rôle « Aucun ».
        </p>
        <p>
          Après un changement de protocole, Vyzio retrouve les flux de la caméra à la vérification
          suivante. « Ajouter un flux » propose ceux qu’elle sert et qui ne sont pas dans la liste,
          y compris un flux retiré.
        </p>
        <p>
          Si la liste ne propose que « Autre chemin… », la caméra ne dit pas quels flux elle sert,
          ou ne répond pas : saisissez le chemin donné par le fabricant.
        </p>
        <p>
          Une caméra qui ne donne pas les dimensions de ses flux les voit nommés « Flux principal »
          ou « Flux secondaire » plutôt qu’avec un chiffre faux.
        </p>
      </HelpPanel>
    </div>
  )
}

function StreamLine({
  stream,
  lineup,
  mainPath,
  available,
  availableError,
  task,
  intents,
}: {
  stream: CameraStream
  lineup: CameraStreamLineup
  mainPath: SettingDeclaration | null
  available: AvailableStream[] | undefined
  availableError: AppError | undefined
  task: StreamTask | undefined
  intents: StreamLineIntents
}) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const state = streamLineState(stream)
  const records = stream.id === lineup.recordStreamId
  const fallback = stream.id === lineup.detectStreamId ? ` ${DETECTION_FALLS_BACK}` : ''
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
      {mainPath && (
        <MainPathChoice
          setting={mainPath}
          stream={stream}
          lineup={lineup}
          available={available}
          error={availableError}
          onOpen={() => intents.onListAvailable(stream.protocol)}
        />
      )}
      {state === StreamLineState.Failed && (
        <div className="text-sm text-destructive">
          <p>{streamFailure(records)}</p>
          {stream.lastError && <DiagnosticLine text={scrubSecrets(stream.lastError)} />}
        </div>
      )}
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
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={task !== undefined}
          onClick={() => intents.onCheck(stream.id)}
        >
          {task === StreamTask.Check ? 'Vérification…' : 'Vérifier'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={DESTRUCTIVE_OUTLINE}
          disabled={records || task !== undefined}
          onClick={() => setConfirmRemove(true)}
        >
          Retirer
        </Button>
        {records && (
          <HelpTrigger
            question="Pourquoi ce flux ne peut-il pas être retiré ?"
            help={RECORDING_STREAM_KEPT}
          />
        )}
      </div>

      {confirmRemove && (
        <ConfirmModal
          title="Retirer ce flux ?"
          body={`Il quitte la liste.${fallback}`}
          confirmLabel="Retirer"
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

/** The main stream's path over RTSP: a declared setting picked from the camera's streams, or typed (ADR-65 e). */
function MainPathChoice({
  setting,
  stream,
  lineup,
  available,
  error,
  onOpen,
}: {
  setting: SettingDeclaration
  stream: CameraStream
  lineup: CameraStreamLineup
  available: AvailableStream[] | undefined
  error: AppError | undefined
  onOpen: () => void
}) {
  const [typing, setTyping] = useState(false)
  const choices = mainPathChoices(available, lineup, stream)
  const selected = typing ? OTHER_PATH : choiceOfPath(choices, String(setting.value))

  // One name for this dropdown and the form's, the typed field keeping the setting's own (DESIGN SYSTEM § stream lines).
  const choice: SettingDeclaration = {
    ...setting,
    label: 'Flux',
    nature: { kind: 'choice', options: choiceOptions(choices), onOpen },
    value: selected.key,
    onChange: (key) => {
      const picked = choices.find((entry) => entry.key === key)
      if (!picked) return
      setTyping(picked.other)
      if (!picked.other) setting.onChange(picked.path ?? '')
    },
  }

  return (
    <>
      <SettingRow setting={choice} />
      {error && <ListFailure error={error} onRetry={onOpen} />}
      {selected.other && (
        <SettingRow setting={{ ...setting, id: `${setting.id}-other`, help: undefined }} />
      )}
    </>
  )
}

function AddStream({
  protocols,
  lineup,
  available,
  availableErrors,
  open,
  adding,
  intents,
}: {
  protocols: ProtocolOption[]
  lineup: CameraStreamLineup
  available: Partial<Record<StreamProtocol, AvailableStream[]>>
  availableErrors: Partial<Record<StreamProtocol, AppError>>
  open: boolean
  adding: boolean
  intents: StreamLineIntents
}) {
  const first = protocols[0].value as StreamProtocol
  return open ? (
    <AddStreamForm
      protocols={protocols}
      first={first}
      lineup={lineup}
      available={available}
      availableErrors={availableErrors}
      adding={adding}
      onList={intents.onListAvailable}
      onAdd={intents.onAdd}
      onCancel={intents.onCloseForm}
    />
  ) : (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="self-start"
      onClick={() => {
        intents.onOpenForm()
        intents.onListAvailable(first)
      }}
    >
      <Plus aria-hidden="true" />
      Ajouter un flux
    </Button>
  )
}

function AddStreamForm({
  protocols,
  first,
  lineup,
  available,
  availableErrors,
  adding,
  onList,
  onAdd,
  onCancel,
}: {
  protocols: ProtocolOption[]
  first: StreamProtocol
  lineup: CameraStreamLineup
  available: Partial<Record<StreamProtocol, AvailableStream[]>>
  availableErrors: Partial<Record<StreamProtocol, AppError>>
  adding: boolean
  onList: (protocol: StreamProtocol) => void
  onAdd: (addition: CameraStreamAddition) => void
  onCancel: () => void
}) {
  const [protocol, setProtocol] = useState<StreamProtocol>(first)
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [role, setRole] = useState<StreamRole>(StreamRole.None)
  const choices = addChoices(available[protocol], lineup, protocol)
  const selectable = choices.filter((choice) => !choice.waiting)
  const error = availableErrors[protocol]
  // Until the user picks, nothing while the camera is asked, then the first it offers, else « Autre chemin… ».
  const selected =
    selectable.find((choice) => choice.key === picked) ??
    (available[protocol] === undefined ? undefined : selectable.at(0))

  function add() {
    if (!selected) return
    onAdd({
      protocol,
      path: selected.other ? typed.trim() || null : selected.path,
      role,
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
            onChange={(value) => {
              setProtocol(value as StreamProtocol)
              setPicked(null)
              onList(value as StreamProtocol)
            }}
          />
        </label>
        {choices.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Flux</span>
            <Picker
              value={(selected ?? choices[0]).key}
              options={choiceOptions(choices)}
              onChange={setPicked}
            />
          </label>
        ) : (
          !error && <p className="text-sm text-muted-foreground">Aucun autre flux à ajouter.</p>
        )}
        {error && <ListFailure error={error} onRetry={() => onList(protocol)} />}
        {selected?.other && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Chemin du flux</span>
            <Input
              placeholder="/stream2"
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value)
                setPicked(OTHER_PATH.key)
              }}
            />
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={adding || !selected}
            onClick={add}
          >
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

/** The camera could not be asked for its streams: said where the list would be, never as an empty list. */
function ListFailure({ error, onRetry }: { error: AppError; onRetry: () => void }) {
  return (
    <ReadFailure
      error={error}
      onRetry={onRetry}
      subject="Vyzio n’a pas pu demander ses flux à la caméra."
    />
  )
}
