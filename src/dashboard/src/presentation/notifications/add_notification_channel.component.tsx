import { useEffect, useReducer } from 'react'
import { MessageCircle } from 'lucide-react'
import { GroupedList, GroupedRow } from '../../common/components/grouped_list'
import { PageHeader } from '../../common/components/page_header'
import { ReadFailure } from '../../common/components/error_message'
import { SettingsPage } from '../../common/settings/settings_page'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { channelSetupLede } from './channel_setup'
import { buildAddNotificationChannelPresenter } from './add_notification_channel.presenter'
import { addNotificationChannelReducer } from './add_notification_channel.reducer'
import { buildInitialAddNotificationChannelUido } from './add_notification_channel.uido'
import { Loading } from '../../common/components/loading'
import { EmptyState } from '../../common/components/empty_state'

/** Adding a channel is one task, one page: the list of what Vyzio can talk through. */
export function AddNotificationChannelView() {
  const { notifications: container } = useAppContainer()
  const [uido, dispatch] = useReducer(
    addNotificationChannelReducer,
    undefined,
    buildInitialAddNotificationChannelUido,
  )
  const presenter = usePresenter(buildAddNotificationChannelPresenter, { container, dispatch })

  useEffect(() => {
    presenter.onLoad()
  }, [presenter])

  const available = uido.channels.filter((channel) => !channel.isConfigured)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Ajouter un canal" />

      <SettingsPage>
        {uido.error ? (
          <ReadFailure
            error={uido.error}
            onRetry={presenter.onLoad}
            subject="Les canaux disponibles n’ont pas pu être lus."
            className="py-3"
          />
        ) : available.length > 0 ? (
          <GroupedList>
            {available.map((channel) => (
              <GroupedRow
                key={channel.channel}
                to={`/settings/notifications/${channel.channel}`}
                icon={MessageCircle}
                title={channel.displayName}
                subtitle={
                  // Said before setting it up, never to let one believe it can be talked to (ADR-14).
                  `${channelSetupLede(channel.channel)} ${
                    channel.acceptsCommands
                      ? 'Vous pourrez aussi lui demander ce qui se passe chez vous.'
                      : 'Ce canal envoie des notifications, mais ne répond pas aux questions.'
                  }`
                }
              />
            ))}
          </GroupedList>
        ) : uido.loading ? (
          <Loading />
        ) : (
          <EmptyState>Tous les canaux disponibles sont déjà en place.</EmptyState>
        )}
      </SettingsPage>
    </div>
  )
}
