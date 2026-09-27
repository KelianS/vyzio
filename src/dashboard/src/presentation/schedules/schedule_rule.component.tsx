import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { SettingsPage } from '../../common/settings/settings_page'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import { midnightRangeHint } from '../../common/settings/midnight_range'
import type { SettingDeclaration, SettingOption } from '../../common/settings/setting_declaration'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { ErrorMessage, ReadFailure } from '../../common/components/error_message'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import {
  endsNextDay,
  SCHEDULE_KINDS,
  SCHEDULE_TYPES,
  SCHEDULES_PATH,
  WEEK_DAYS,
} from '../../common/schedule/schedule_types'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import {
  ScheduleRuleKind,
  ScheduleTargetKind,
  type ScheduleRule,
} from '../../domain/entities/schedule_rule.entity'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { buildScheduleRulePresenter } from './schedule_rule.presenter'
import { scheduleRuleReducer } from './schedule_rule.reducer'
import { buildInitialScheduleRuleUido, type ScheduleRuleUido } from './schedule_rule.uido'

interface RuleValues {
  kind: ScheduleRuleKind
  targetIds: string[]
  days: number[]
  startTime: string
  endTime: string
}

const NEW_RULE: RuleValues = {
  kind: ScheduleRuleKind.Privacy,
  targetIds: [],
  days: [1, 2, 3, 4, 5],
  startTime: '22:00',
  endTime: '06:00',
}

const TARGETS_LABEL: Record<ScheduleTargetKind, string> = {
  [ScheduleTargetKind.Camera]: 'Caméras',
  [ScheduleTargetKind.Channel]: 'Canaux',
}

// The targets are named as the field names them, cameras or channels.
const DRAFT_LABELS: Record<ScheduleTargetKind, Record<keyof RuleValues, string>> = {
  [ScheduleTargetKind.Camera]: draftLabels(TARGETS_LABEL[ScheduleTargetKind.Camera]),
  [ScheduleTargetKind.Channel]: draftLabels(TARGETS_LABEL[ScheduleTargetKind.Channel]),
}

function draftLabels(targets: string): Record<keyof RuleValues, string> {
  return { kind: 'Type', targetIds: targets, days: 'Jours', startTime: 'Début', endTime: 'Fin' }
}

const NO_TARGET_CHOSEN: Record<ScheduleTargetKind, string> = {
  [ScheduleTargetKind.Camera]: 'Aucune caméra',
  [ScheduleTargetKind.Channel]: 'Aucun canal',
}

const KIND_OPTIONS = SCHEDULE_KINDS.map((kind) => ({
  value: kind,
  label: SCHEDULE_TYPES[kind].name,
}))

const DAY_OPTIONS: readonly SettingOption[] = WEEK_DAYS.map((day) => ({
  value: String(day.value),
  label: day.name,
}))

/** One range editor for every rule type (ADR-63): adding at `ajout`, editing at the rule's id. */
export function ScheduleRuleView() {
  const { ruleId = null } = useParams()
  const {
    schedules: container,
    notifications: notificationsContainer,
    cameras: camerasContainer,
  } = useAppContainer()
  const { toast } = useToast()
  const cameras = useRootStore((state) => state.cameras)
  const camerasLoading = useRootStore((state) => state.camerasLoading)
  const camerasError = useRootStore((state) => state.camerasError)
  const [uido, dispatch] = useReducer(scheduleRuleReducer, undefined, buildInitialScheduleRuleUido)
  const presenter = usePresenter(buildScheduleRulePresenter, {
    container,
    notificationsContainer,
    camerasContainer,
    dispatch,
    toast,
  })

  useEffect(() => {
    presenter.onLoad(ruleId)
  }, [presenter, ruleId])

  const title = ruleId === null ? 'Ajouter une plage' : 'Plage'

  if (uido.gone)
    return (
      <Page title="Plage introuvable">
        <p className="text-muted-foreground">Cette plage a été supprimée entre-temps.</p>
      </Page>
    )
  if (camerasError && cameras.length === 0)
    return (
      <Page title={title}>
        <ReadFailure
          error={camerasError}
          onRetry={presenter.onReloadCameras}
          subject="La liste de vos caméras n’a pas pu être lue."
        />
      </Page>
    )
  if (uido.readError)
    return (
      <Page title={title}>
        <ReadFailure
          error={uido.readError}
          onRetry={() => presenter.onLoad(ruleId)}
          subject={
            ruleId === null
              ? 'Les canaux de notification n’ont pas pu être lus.'
              : 'Cette plage n’a pas pu être lue.'
          }
        />
      </Page>
    )
  if (uido.loading || (camerasLoading && cameras.length === 0))
    return (
      <Page title={title}>
        <p className="text-muted-foreground">Chargement…</p>
      </Page>
    )

  const cameraOptions = cameras.map((camera) => ({ value: camera.id, label: camera.displayName }))
  const channelOptions = uido.channels.map((channel) => ({
    value: channel.channel,
    label: channel.displayName,
  }))
  const targetOptions: Record<ScheduleTargetKind, SettingOption[]> = {
    [ScheduleTargetKind.Camera]: cameraOptions,
    [ScheduleTargetKind.Channel]: channelOptions,
  }

  return (
    <RuleForm
      // Another rule, or adding after editing, starts a fresh draft.
      key={uido.rule?.id ?? 'new'}
      rule={uido.rule}
      uido={uido}
      targetOptions={targetOptions}
      presenter={presenter}
    />
  )
}

function toValues(
  rule: ScheduleRule | null,
  targetOptions: Record<ScheduleTargetKind, SettingOption[]>,
): RuleValues {
  if (rule === null) return NEW_RULE
  const known = new Set(targetOptions[SCHEDULE_TYPES[rule.kind].targetKind].map((o) => o.value))
  return {
    kind: rule.kind,
    // A target Vyzio no longer knows is not offered, so saving drops it.
    targetIds: rule.targetIds.filter((id) => known.has(id)),
    days: rule.daysOfWeek,
    startTime: rule.startTime,
    endTime: rule.endTime,
  }
}

function RuleForm({
  rule,
  uido,
  targetOptions,
  presenter,
}: {
  rule: ScheduleRule | null
  uido: ScheduleRuleUido
  targetOptions: Record<ScheduleTargetKind, SettingOption[]>
  presenter: ReturnType<typeof buildScheduleRulePresenter>
}) {
  const navigate = useNavigate()
  const draft = useSettingsDraft<RuleValues>({
    saved: toValues(rule, targetOptions),
    labels: DRAFT_LABELS[SCHEDULE_TYPES[rule?.kind ?? NEW_RULE.kind].targetKind],
  })
  useUnsavedChanges(draft.dirty)
  // Left once the draft is cleared: declared after the guard's signal, so it runs after it.
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (leaving) void navigate(SCHEDULES_PATH)
  }, [leaving, navigate])

  const values = draft.values
  const type = SCHEDULE_TYPES[values.kind]
  const input = {
    targetIds: values.targetIds,
    daysOfWeek: values.days,
    startTime: values.startTime,
    endTime: values.endTime,
  }

  const settings: SettingDeclaration[] = [
    {
      id: 'rule-kind',
      label: 'Type',
      nature: { kind: 'choice', options: KIND_OPTIONS },
      // The effect is the point of the choice: it stays visible, never behind a gesture (ADR-43).
      consequence: type.effect,
      // What a rule targets depends on its type: once it exists, its type stays.
      disabled: rule !== null,
      help:
        rule === null
          ? undefined
          : 'Le type d’une plage ne change plus une fois ajoutée : supprimez-la, puis ajoutez-en une autre.',
      value: values.kind,
      onChange: (value) => {
        draft.set('kind', value as ScheduleRuleKind)
        draft.set('targetIds', [])
      },
    },
    {
      id: 'rule-targets',
      label: TARGETS_LABEL[type.targetKind],
      nature: {
        kind: 'multiChoice',
        options: targetOptions[type.targetKind],
        emptySummary: NO_TARGET_CHOSEN[type.targetKind],
      },
      value: values.targetIds,
      onChange: (value) => draft.set('targetIds', value as string[]),
    },
    {
      id: 'rule-days',
      label: 'Jours',
      nature: { kind: 'multiChoice', options: DAY_OPTIONS, emptySummary: 'Aucun jour' },
      value: values.days.map(String),
      onChange: (value) => draft.set('days', (value as string[]).map(Number)),
    },
    {
      id: 'rule-start',
      label: 'Début',
      nature: { kind: 'time' },
      value: values.startTime,
      onChange: (value) => draft.set('startTime', value as string),
    },
    {
      id: 'rule-end',
      label: 'Fin',
      nature: { kind: 'time' },
      consequence: endsNextDay(values.startTime, values.endTime)
        ? midnightRangeHint(values.endTime)
        : undefined,
      value: values.endTime,
      onChange: (value) => draft.set('endTime', value as string),
    },
  ]

  const savedTargets = targetOptions[type.targetKind]
    .filter((option) => draft.saved.targetIds.includes(option.value))
    .map((option) => option.label)

  async function add() {
    if (!(await presenter.onCreate({ kind: values.kind, ...input }))) return
    draft.accept()
    setLeaving(true)
  }

  async function remove(ruleId: string) {
    if (!(await presenter.onDelete(ruleId))) return
    draft.discard()
    setLeaving(true)
  }

  return (
    <Page title={rule === null ? 'Ajouter une plage' : type.name}>
      <SettingsPage lede="Aux heures de la maison. Une plage déjà commencée s’applique dans la minute.">
        <SettingsList settings={settings} />

        {uido.failure && <ErrorMessage error={uido.failure} className="mt-3" />}

        <div className="mt-5 flex flex-wrap gap-2">
          {rule === null ? (
            <Button type="button" disabled={uido.saving} onClick={() => void add()}>
              {uido.saving ? 'Ajout…' : 'Ajouter'}
            </Button>
          ) : (
            <Button type="button" variant="destructive" onClick={presenter.onAskDelete}>
              Supprimer la plage
            </Button>
          )}
        </div>
      </SettingsPage>

      {rule !== null && (
        <SettingsDraftBar
          changes={draft.changes}
          saving={uido.saving}
          onSave={async () => {
            if (await presenter.onUpdate(rule.id, input)) draft.accept()
          }}
          onDiscard={draft.discard}
        />
      )}

      {rule !== null && uido.confirmDelete && (
        <ConfirmModal
          title="Supprimer cette plage ?"
          body={`La plage « ${type.name} » de ${rule.startTime} à ${rule.endTime}${
            savedTargets.length > 0 ? ` sur ${savedTargets.join(', ')}` : ''
          } ne s’appliquera plus.`}
          confirmLabel="Supprimer"
          tone="danger"
          loading={uido.deleting}
          onConfirm={() => remove(rule.id)}
          onCancel={presenter.onCancelDelete}
        />
      )}
    </Page>
  )
}

/** The editor names itself and gives its own way back to the week (OWN_HEADER). */
function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to={SCHEDULES_PATH}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Planification
        </Link>
        <h1 className="mt-1 font-serif text-3xl">{title}</h1>
      </div>
      {children}
    </div>
  )
}
