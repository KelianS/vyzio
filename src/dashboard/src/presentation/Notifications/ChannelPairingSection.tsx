import { useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type {
  ChannelPairing,
  NotificationChannelName,
} from '../../domain/entities/NotificationChannelConfig'

const formatDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })
const formatTime = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' })

/**
 * Which conversation may command this installation — started here and nowhere else, because the
 * settings are the only place Vyzio knows it is really the owner talking (ADR-50).
 */
export function ChannelPairingSection({
  channel,
  displayName,
}: {
  channel: NotificationChannelName
  displayName: string
}) {
  const { notifications: container } = useAppContainer()
  const { toast } = useToast()
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const pairing = useAsync(() => container.getChannelPairing.execute(channel), [channel])

  const starting = useAsyncAction(() => container.startChannelPairing.execute(channel), {
    onSuccess: () => pairing.reload(),
  })

  const revoking = useAsyncAction(() => container.revokeChannelPairing.execute(channel), {
    onSuccess: () => {
      toast('La conversation ne peut plus commander votre installation.', 'info')
      setConfirmRevoke(false)
      pairing.reload()
    },
  })

  if (pairing.loading && !pairing.data) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>
  }

  const status = pairing.data?.status ?? 'not_paired'

  return (
    <>
      <div className="flex flex-col gap-4">
        {status === 'awaiting_conversation' ? (
          <AwaitingConversation pairing={pairing.data!} displayName={displayName} />
        ) : (
          <p className="text-sm text-muted-foreground">{describe(status, pairing.data ?? null)}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {status === 'paired' ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmRevoke(true)}>
              Couper le lien
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={starting.loading}
              onClick={() => void starting.run()}
            >
              {status === 'awaiting_conversation' ? 'Générer un autre code' : 'Relier une conversation'}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pairing.loading}
            onClick={pairing.reload}
          >
            <RotateCw className={cn(pairing.loading && 'animate-spin')} aria-hidden="true" />
            Actualiser
          </Button>
        </div>
      </div>

      {confirmRevoke && (
        <ConfirmModal
          title="Couper le lien avec cette conversation ?"
          body="Elle ne pourra plus rien demander à votre installation. Les alertes, elles, continuent d’arriver."
          confirmLabel="Couper le lien"
          tone="danger"
          loading={revoking.loading}
          onConfirm={() => void revoking.run()}
          onCancel={() => setConfirmRevoke(false)}
        />
      )}
    </>
  )
}

function AwaitingConversation({
  pairing,
  displayName,
}: {
  pairing: ChannelPairing
  displayName: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Dans {displayName}, ouvrez la conversation qui doit commander votre installation et
        envoyez-lui&nbsp;:
      </p>
      <p className="font-mono text-2xl tracking-widest">/pair {pairing.code}</p>
      {pairing.codeExpiresAt && (
        <p className="text-sm text-muted-foreground">
          Ce code est valable jusqu’à {formatTime.format(new Date(pairing.codeExpiresAt))}. Passé ce
          délai, générez-en un autre.
        </p>
      )}
    </div>
  )
}

/** One sentence per state; a stranger's message is never mentioned because it never gets an answer. */
function describe(status: ChannelPairing['status'], pairing: ChannelPairing | null): string {
  switch (status) {
    case 'not_paired':
      return 'Aucune conversation ne peut commander votre installation.'
    case 'expired':
      return 'Le code précédent a expiré sans être utilisé.'
    case 'paired':
      return pairing?.pairedAt
        ? `Une conversation est reliée depuis le ${formatDate.format(new Date(pairing.pairedAt))}.`
        : 'Une conversation est reliée.'
    case 'awaiting_conversation':
      return 'Un code est en attente.'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}
