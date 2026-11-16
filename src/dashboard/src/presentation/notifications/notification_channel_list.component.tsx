import { useEffect, useReducer } from 'react'
import { MessageCircle, Plus } from 'lucide-react'
import { ReadFailure } from '../../common/components/error_message'
import { GroupedList, GroupedRow } from '../../common/components/grouped_list'
import { SettingsPage } from '../../common/settings/settings_page'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { buildNotificationChannelListPresenter } from './notification_channel_list.presenter'
import { notificationChannelListReducer } from './notification_channel_list.reducer'
import { buildInitialNotificationChannelListUido } from './notification_channel_list.uido'
import { Loading } from '../../common/components/loading'
import { EmptyState } from '../../common/components/empty_state'

/** First level of the Notifications rubric: the channels in place. Adding one is its own task/page. */
export function NotificationChannelListView() {
  const { notifications: container } = useAppContainer()
  const [uido, dispatch] = useReducer(
    notificationChannelListReducer,
    undefined,
    buildInitialNotificationChannelListUido,
  )
  const presenter = usePresenter(buildNotificationChannelListPresenter, { container, dispatch })

  useEffect(() => {
    presenter.onLoad()
  }, [presenter])

  const configured = uido.channels.filter((channel) => channel.isConfigured)
  const remaining = uido.channels.length - configured.length

  return (
    <SettingsPage>
      {uido.error ? (
        <ReadFailure
          error={uido.error}
          onRetry={presenter.onLoad}
          subject="La liste de vos canaux n’a pas pu être lue."
          className="py-3"
        />
      ) : uido.loading && uido.channels.length === 0 ? (
        <Loading />
      ) : (
        <>
          {configured.length === 0 && (
            <EmptyState>
              Aucun canal pour l’instant : aucune notification n’est envoyée, les détections restent
              dans l’historique.
            </EmptyState>
          )}
          <GroupedList>
            {configured.map((channel) => (
              <GroupedRow
                key={channel.channel}
                to={`/settings/notifications/${channel.channel}`}
                icon={MessageCircle}
                title={channel.displayName}
              />
            ))}
            {remaining > 0 && (
              <GroupedRow
                to="/settings/notifications/add"
                icon={Plus}
                title="Ajouter un canal"
                trailing="none"
              />
            )}
          </GroupedList>
        </>
      )}
    </SettingsPage>
  )
}
