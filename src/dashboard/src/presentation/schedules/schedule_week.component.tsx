import { useEffect, useReducer } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { SettingsPage } from '../../common/settings/settings_page'
import { HelpPanel } from '../../common/components/help_panel'
import { ReadFailure } from '../../common/components/error_message'
import { SCHEDULES_UNREAD } from '../../common/schedule/schedule_count_line'
import { SCHEDULE_TYPES, SCHEDULES_PATH } from '../../common/schedule/schedule_types'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import {
  ScheduleTargetKind,
  type ScheduleRuleKind,
} from '../../domain/entities/schedule_rule.entity'
import { buildScheduleWeekPresenter } from './schedule_week.presenter'
import { scheduleWeekReducer } from './schedule_week.reducer'
import { buildInitialScheduleWeekUido } from './schedule_week.uido'
import { entryTimes, targetSummary, weekOf, type WeekEntry } from './schedule_week.formatters'

const NO_TARGET: Record<ScheduleTargetKind, string> = {
  [ScheduleTargetKind.Camera]: 'Plus aucune caméra visée',
  [ScheduleTargetKind.Channel]: 'Plus aucun canal visé',
}

/** The house's calendar (ADR-63): the week, day by day, every rule type in one place. */
export function ScheduleWeekView() {
  const {
    schedules: container,
    notifications: notificationsContainer,
    cameras: camerasContainer,
  } = useAppContainer()
  const cameras = useRootStore((state) => state.cameras)
  const camerasLoading = useRootStore((state) => state.camerasLoading)
  const camerasError = useRootStore((state) => state.camerasError)
  const [uido, dispatch] = useReducer(scheduleWeekReducer, undefined, buildInitialScheduleWeekUido)
  const presenter = usePresenter(buildScheduleWeekPresenter, {
    container,
    notificationsContainer,
    camerasContainer,
    dispatch,
  })

  useEffect(() => {
    presenter.onLoad()
  }, [presenter])

  // Unread cameras would leave every privacy range without its targets: not an answer either.
  if (camerasError && cameras.length === 0)
    return (
      <SettingsPage>
        <ReadFailure
          error={camerasError}
          onRetry={presenter.onReloadCameras}
          subject="La liste de vos caméras n’a pas pu être lue."
        />
      </SettingsPage>
    )
  if (uido.error)
    return (
      <SettingsPage>
        <ReadFailure error={uido.error} onRetry={presenter.onLoad} subject={SCHEDULES_UNREAD} />
      </SettingsPage>
    )
  if (uido.loading || (camerasLoading && cameras.length === 0))
    return <SettingsPage>Chargement…</SettingsPage>

  const cameraNames = new Map(cameras.map((camera) => [camera.id, camera.displayName]))
  const channelNames = new Map<string, string>(
    uido.channels.map((channel) => [channel.channel, channel.displayName]),
  )
  const namesOf: Record<ScheduleTargetKind, Map<string, string>> = {
    [ScheduleTargetKind.Camera]: cameraNames,
    [ScheduleTargetKind.Channel]: channelNames,
  }
  const nameOf = (kind: ScheduleRuleKind, id: string) =>
    namesOf[SCHEDULE_TYPES[kind].targetKind].get(id)

  return (
    <SettingsPage lede="Ce qui se passe à heure fixe dans la maison, aux heures de la maison.">
      <ol className="flex flex-col gap-5">
        {weekOf(uido.rules).map((day) => (
          <li key={day.value}>
            <h2 className="font-medium">{day.name}</h2>
            {day.entries.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Rien de prévu</p>
            ) : (
              <ul className="mt-1 divide-y divide-border">
                {day.entries.map((entry) => (
                  <li key={`${entry.rule.id}-${entry.tail ? 'tail' : 'start'}`}>
                    <WeekEntryRow
                      entry={entry}
                      targets={
                        targetSummary(entry.rule, nameOf) ??
                        NO_TARGET[SCHEDULE_TYPES[entry.rule.kind].targetKind]
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <Button asChild>
          <Link to={`${SCHEDULES_PATH}/ajout`}>
            <Plus aria-hidden="true" />
            Ajouter une plage
          </Link>
        </Button>
      </div>

      <HelpPanel title="Que fait chaque plage, et quand ?">
        <p>
          Une plage « Vie privée » coupe les caméras qu’elle vise : rien n’est enregistré ni
          détecté, et aucune notification ne part. Une plage « Sans notification » laisse les
          caméras filmer et enregistrer : seuls les canaux visés n’envoient rien, et les détections
          restent dans l’historique.
        </p>
        <p>
          Une plage peut passer minuit : 22:00 → 06:00 commence le soir des jours choisis et se
          termine le lendemain à 06:00. Les heures sont celles de la maison, même quand vous
          consultez Vyzio depuis un autre fuseau horaire.
        </p>
        <p>Une plage enregistrée s’applique dans la minute, même si elle est déjà commencée.</p>
      </HelpPanel>
    </SettingsPage>
  )
}

function WeekEntryRow({ entry, targets }: { entry: WeekEntry; targets: string }) {
  const type = SCHEDULE_TYPES[entry.rule.kind]
  const Icon = type.icon
  return (
    <Link
      to={`${SCHEDULES_PATH}/${entry.rule.id}`}
      className="flex items-center gap-3 rounded-md py-2.5 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {type.name} · <span className="tabular-nums">{entryTimes(entry)}</span>
        </span>
        <span className="block truncate text-sm text-muted-foreground">{targets}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
