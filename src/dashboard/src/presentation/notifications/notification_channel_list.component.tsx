import { useEffect, useReducer } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { ReadFailure } from '../../common/components/error_message'
import { Button } from '../../common/ui/button'
import { SettingsPage } from '../../common/settings/settings_page'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { buildNotificationChannelListPresenter } from './notification_channel_list.presenter'
import { notificationChannelListReducer } from './notification_channel_list.reducer'
import { buildInitialNotificationChannelListUido } from './notification_channel_list.uido'
import { ListRow } from '../../common/components/list_row'
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
      ) : configured.length > 0 ? (
        <ul className="divide-y divide-border">
          {configured.map((channel) => (
            <li key={channel.channel}>
              <ListRow>
                <Link to={`/settings/notifications/${channel.channel}`}>
                  <span className="min-w-0 font-medium">{channel.displayName}</span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </ListRow>
            </li>
          ))}
        </ul>
      ) : uido.loading ? (
        <Loading />
      ) : (
        <EmptyState>
          Aucun canal pour l’instant : aucune notification n’est envoyée, les détections restent
          dans l’historique.
        </EmptyState>
      )}

      {remaining > 0 && (
        <div className="mt-5">
          <Button asChild>
            <Link to="/settings/notifications/ajout">
              <Plus aria-hidden="true" />
              Ajouter un canal
            </Link>
          </Button>
        </div>
      )}
    </SettingsPage>
  )
}
