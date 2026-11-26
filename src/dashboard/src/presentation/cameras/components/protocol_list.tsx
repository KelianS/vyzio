import { useState, type ReactNode } from 'react'
import { Network, RefreshCw } from 'lucide-react'
import { ConfirmModal } from '../../../common/components/confirm_modal'
import { DiagnosticLine, ReadFailure } from '../../../common/components/error_message'
import { GroupedList } from '../../../common/components/grouped_list'
import { Loading } from '../../../common/components/loading'
import { SecondaryButton } from '../../../common/components/secondary_button'
import type { AppError } from '../../../common/errors/app_error'
import { scrubSecrets } from '../../../common/errors/scrub_secrets'
import { SettingsList } from '../../../common/settings/settings_list'
import { Button } from '../../../common/ui/button'
import type { CameraProtocol } from '../../../domain/entities/camera_protocol.entity'
import type { ProtocolValues } from '../camera_connection_values'
import { formatCheckedAt } from '../cameras.formatters'
import { protocolFailureLine, protocolMark } from '../capability_state'
import { PROTOCOL_LABELS } from '../protocol_labels'
import { CapabilityCard } from './capability_card'
import { protocolSettings, removalBlocker } from './protocol_settings'

/** The protocols the camera speaks, one card each with its mark, opening in place like a capability (CAM-17, CAM-23). */
export function ProtocolList({
  loading,
  readError,
  onRetryRead,
  children,
}: {
  loading: boolean
  readError: AppError | null
  onRetryRead: () => void
  /** One `ProtocolCard` per protocol. */
  children: ReactNode
}) {
  if (loading) return <Loading />
  if (readError)
    return (
      <ReadFailure
        error={readError}
        onRetry={onRetryRead}
        subject="Les protocoles de cette caméra n’ont pas pu être lus."
      />
    )

  return <GroupedList label="Protocoles">{children}</GroupedList>
}

/** One protocol: its state, its port and account behind `Options`, its own check, its removal (CAM-17, CAM-46). */
export function ProtocolCard({
  entry,
  values,
  onChange,
  usedBy,
  edited,
  checking,
  removing,
  onCheck,
  onRemove,
}: {
  entry: CameraProtocol
  values: ProtocolValues
  onChange: (patch: Partial<ProtocolValues>) => void
  /** The capabilities going through it, named. */
  usedBy: string[]
  /** Its settings differ from what is saved. */
  edited: boolean
  checking: boolean
  removing: boolean
  onCheck: () => void
  /** Resolves true once removed. */
  onRemove: () => Promise<boolean>
}) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const label = PROTOCOL_LABELS[entry.protocol]
  const failure = protocolFailureLine(entry.status)
  const blocker = removalBlocker(usedBy, edited)

  return (
    <>
      <CapabilityCard
        icon={Network}
        title={label}
        mark={protocolMark(entry.status)}
        options={<SettingsList nested settings={protocolSettings(entry, values, onChange)} />}
        actions={
          <>
            <SecondaryButton
              icon={RefreshCw}
              type="button"
              size="sm"
              disabled={checking}
              onClick={onCheck}
            >
              {checking ? 'Vérification…' : 'Vérifier'}
            </SecondaryButton>
            <Button
              type="button"
              variant="destructive-outline"
              size="sm"
              disabled={blocker !== null}
              onClick={() => setConfirmRemove(true)}
            >
              Retirer
            </Button>
            {/* Under the actions, so an edit that raises it never moves the fields above. */}
            {blocker && <p className="basis-full text-body text-muted-foreground">{blocker}</p>}
          </>
        }
      >
        {failure && <p className="text-body text-destructive">{failure}</p>}
        {entry.lastError && <DiagnosticLine text={scrubSecrets(entry.lastError)} />}
        {entry.checkedAt && (
          <p className="text-body text-muted-foreground">
            Vérifié le {formatCheckedAt(entry.checkedAt)}
          </p>
        )}
      </CapabilityCard>

      {confirmRemove && (
        <ConfirmModal
          title={`Retirer ${label} ?`}
          body="Vyzio oublie comment joindre la caméra par ce protocole, son port et son compte spécifique. Vous pourrez l’ajouter à nouveau."
          confirmLabel="Retirer"
          tone="danger"
          loading={removing}
          onConfirm={async () => {
            await onRemove()
            setConfirmRemove(false)
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </>
  )
}
