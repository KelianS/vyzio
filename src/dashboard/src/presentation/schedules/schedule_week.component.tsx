import { useEffect, useReducer } from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import { SettingsPage } from '../../common/settings/settings_page'
import { HelpPanel } from '../../common/components/help_panel'
import { ReadFailure } from '../../common/components/error_message'
import { SCHEDULES_UNREAD } from '../../common/schedule/schedule_count_line'
import {
  minutesOf,
  SCHEDULE_KINDS,
  SCHEDULE_TYPES,
  SCHEDULES_PATH,
} from '../../common/schedule/schedule_types'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import {
  ScheduleTargetKind,
  type HouseClock,
  type ScheduleRule,
  type ScheduleRuleKind,
} from '../../domain/entities/schedule_rule.entity'
import { buildScheduleWeekPresenter } from './schedule_week.presenter'
import { scheduleWeekReducer } from './schedule_week.reducer'
import { buildInitialScheduleWeekUido } from './schedule_week.uido'
import {
  barOf,
  DAY_MINUTES,
  entryTimes,
  targetSummary,
  weekOf,
  type BarBlock,
  type WeekDay,
} from './schedule_week.formatters'

const NO_TARGET: Record<ScheduleTargetKind, string> = {
  [ScheduleTargetKind.Camera]: 'Plus aucune caméra visée',
  [ScheduleTargetKind.Channel]: 'Plus aucun canal visé',
}

/** A block's height plus the gap to the lane below, in pixels. */
const LANE_PX = 28
const HOUR_MARKS = [0, 6, 12, 18, 24]
const GUIDE_HOURS = [6, 12, 18]

const percentOf = (minutes: number) => `${(minutes / DAY_MINUTES) * 100}%`

/** The house's calendar (ADR-63): the week as seven 24-hour bars, every rule type in one place. */
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

  useEffect(() => presenter.onWatchClock(), [presenter])

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
  const targetsOf = (rule: ScheduleRule) => targetSummary(rule, nameOf)
  const orphans = uido.rules.filter((rule) => targetsOf(rule) === null)

  return (
    <SettingsPage lede="Ce qui se passe à heure fixe dans la maison, aux heures de la maison.">
      <HourMarks />
      <ol className="mt-1 flex flex-col gap-2">
        {weekOf(uido.rules).map((day) => (
          <DayRow key={day.value} day={day} clock={uido.clock} targetsOf={targetsOf} />
        ))}
      </ol>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {SCHEDULE_KINDS.map((kind) => {
          const type = SCHEDULE_TYPES[kind]
          const Icon = type.icon
          return (
            <li key={kind} className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex h-4 w-6 items-center justify-center rounded-sm',
                  type.fill,
                )}
              >
                <Icon className="size-3" aria-hidden="true" />
              </span>
              {type.name}
            </li>
          )
        })}
      </ul>

      {orphans.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1 text-sm">
          {orphans.map((rule) => (
            <li key={rule.id}>
              <Link
                to={`${SCHEDULES_PATH}/${rule.id}`}
                className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {SCHEDULE_TYPES[rule.kind].name} ·{' '}
                <span className="tabular-nums">{entryTimes({ rule, tail: false })}</span> ·{' '}
                {NO_TARGET[SCHEDULE_TYPES[rule.kind].targetKind]}
              </Link>
            </li>
          ))}
        </ul>
      )}

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

/** The day label column's width, shared by the hour marks so they sit above the bars. */
const ROW_GRID = 'grid grid-cols-[2.5rem_1fr] items-center gap-2'

function HourMarks() {
  return (
    <div className={ROW_GRID} aria-hidden="true">
      <span />
      <div className="relative h-4 text-xs text-muted-foreground tabular-nums">
        {HOUR_MARKS.map((hour, index) => (
          <span
            key={hour}
            className={cn(
              'absolute top-0',
              index === 0 && 'translate-x-0',
              index === HOUR_MARKS.length - 1 && '-translate-x-full',
              index > 0 && index < HOUR_MARKS.length - 1 && '-translate-x-1/2',
            )}
            style={{ left: percentOf(hour * 60) }}
          >
            {hour}
          </span>
        ))}
      </div>
    </div>
  )
}

function DayRow({
  day,
  clock,
  targetsOf,
}: {
  day: WeekDay
  clock: HouseClock | null
  targetsOf: (rule: ScheduleRule) => string | null
}) {
  const today = clock !== null && clock.dayOfWeek === day.value
  const { blocks, lanes } = barOf(day.entries)
  return (
    <li className={ROW_GRID}>
      <h2>
        {/* On the span: the global heading face and colour would win over classes on the h2. */}
        <span
          aria-hidden="true"
          className={cn(
            'font-sans text-sm',
            today ? 'font-semibold text-primary' : 'text-muted-foreground',
          )}
        >
          {day.short}
        </span>
        <span className="sr-only">{day.name}</span>
      </h2>
      <div
        className="relative border border-border bg-muted"
        style={{ height: lanes * LANE_PX + 4 }}
      >
        {GUIDE_HOURS.map((hour) => (
          <span
            key={hour}
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-border"
            style={{ left: percentOf(hour * 60) }}
          />
        ))}
        {blocks.length === 0 ? (
          <p className="sr-only">Rien de prévu</p>
        ) : (
          <ul>
            {blocks.map((block) => (
              <li key={`${block.entry.rule.id}-${block.entry.tail ? 'tail' : 'start'}`}>
                <RangeBlock block={block} targets={targetsOf(block.entry.rule)} />
              </li>
            ))}
          </ul>
        )}
        {today && (
          <span
            role="img"
            aria-label={`Maintenant, ${clock.time}`}
            className="absolute -inset-y-1 z-10 w-0.5 -translate-x-1/2 bg-destructive"
            style={{ left: percentOf(minutesOf(clock.time)) }}
          />
        )}
      </div>
    </li>
  )
}

function RangeBlock({ block, targets }: { block: BarBlock; targets: string | null }) {
  const { entry, start, end, continues, lane } = block
  const type = SCHEDULE_TYPES[entry.rule.kind]
  const Icon = type.icon
  const named = targets ?? NO_TARGET[type.targetKind]
  return (
    <Link
      to={`${SCHEDULES_PATH}/${entry.rule.id}`}
      aria-label={`${type.name} · ${entryTimes(entry)} · ${named}`}
      className={cn(
        'absolute flex h-6 items-center overflow-hidden rounded-sm px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        targets === null
          ? 'border border-dashed border-muted-foreground bg-card text-muted-foreground'
          : type.fill,
        continues && 'rounded-r-none',
        entry.tail && 'rounded-l-none',
      )}
      style={{
        top: lane * LANE_PX + 2,
        // Never narrower than its icon, and never past the bar's end (DESIGN SYSTEM § Calendar).
        left: `min(${percentOf(start)}, 100% - 1.5rem)`,
        width: `max(1.5rem, ${percentOf(end - start)})`,
      }}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
    </Link>
  )
}
