import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useGoBack } from '../../common/navigation/use_go_back'
import { PageHeader } from '../../common/components/page_header'
import { Button } from '../../common/ui/button'
import { Input } from '../../common/ui/input'
import { Field } from '../../common/components/field'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { SettingOption } from '../../common/settings/setting_declaration'
import { DeleteAction } from '../../common/components/delete_action'
import { ErrorMessage, ReadFailure } from '../../common/components/error_message'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import {
  endsNextDay,
  KIND_PARAM,
  SCHEDULE_KINDS,
  SCHEDULE_TYPES,
  SCHEDULES_PATH,
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
import { Loading } from '../../common/components/loading'
import { formatHouseTime } from '../../common/schedule/house_moment'
import { DayToggles } from './components/day_toggles'
import { TargetChecks } from './components/target_checks'

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

const NO_TARGET_TO_CHOOSE: Record<ScheduleTargetKind, string> = {
  [ScheduleTargetKind.Camera]: 'Aucune caméra à viser pour l’instant.',
  [ScheduleTargetKind.Channel]: 'Aucun canal configuré pour l’instant.',
}

/** The type the address asks for, privacy when it names none Vyzio knows. */
function kindOf(value: string | null): ScheduleRuleKind {
  return SCHEDULE_KINDS.find((kind) => kind === value) ?? ScheduleRuleKind.Privacy
}

/** One range editor for every rule type (ADR-15): adding at `add`, editing at the rule's id. */
export function ScheduleRuleView() {
  const { ruleId = null } = useParams()
  const [searchParams] = useSearchParams()
  const newKind = kindOf(searchParams.get(KIND_PARAM))
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

  const title = ruleId === null ? SCHEDULE_TYPES[newKind].name : 'Plage'

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
        <Loading />
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
      key={uido.rule?.id ?? `new-${newKind}`}
      rule={uido.rule}
      kind={uido.rule?.kind ?? newKind}
      uido={uido}
      targetOptions={targetOptions}
      presenter={presenter}
    />
  )
}

function toValues(
  rule: ScheduleRule | null,
  kind: ScheduleRuleKind,
  targetOptions: Record<ScheduleTargetKind, SettingOption[]>,
): RuleValues {
  if (rule === null) return { ...NEW_RULE, kind }
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
  kind,
  uido,
  targetOptions,
  presenter,
}: {
  rule: ScheduleRule | null
  /** A new range's type, from the list it is added to; an existing one keeps its own. */
  kind: ScheduleRuleKind
  uido: ScheduleRuleUido
  targetOptions: Record<ScheduleTargetKind, SettingOption[]>
  presenter: ReturnType<typeof buildScheduleRulePresenter>
}) {
  const goBack = useGoBack()
  const draft = useSettingsDraft<RuleValues>({
    saved: toValues(rule, kind, targetOptions),
    labels: DRAFT_LABELS[SCHEDULE_TYPES[kind].targetKind],
  })
  useUnsavedChanges(draft.dirty)
  // Left once the draft is cleared: declared after the guard's signal, so it runs after it.
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (leaving) goBack(SCHEDULES_PATH)
  }, [leaving, goBack])

  const values = draft.values
  const type = SCHEDULE_TYPES[values.kind]
  const input = {
    targetIds: values.targetIds,
    daysOfWeek: values.days,
    startTime: values.startTime,
    endTime: values.endTime,
  }

  const savedTargets = targetOptions[type.targetKind]
    .filter((option) => draft.saved.targetIds.includes(option.value))
    .map((option) => option.label)

  /** Saving takes the user back to the week, which shows the result (SCHED-10). */
  async function save() {
    const saved =
      rule === null
        ? await presenter.onCreate({ kind: values.kind, ...input })
        : await presenter.onUpdate(rule.id, input)
    if (!saved) return
    draft.accept()
    setLeaving(true)
  }

  async function remove(ruleId: string) {
    if (!(await presenter.onDelete(ruleId))) return
    draft.discard()
    setLeaving(true)
  }

  return (
    <Page title={type.name}>
      {/* The type's effect stays in view while the range is set (SCHED-02). */}
      <SettingsPage lede={type.effect}>
        <SettingsSection title="Horaire">
          <div className="grid grid-cols-2 gap-3">
            <Field label="De">
              <Input
                type="time"
                value={values.startTime}
                onChange={(event) => draft.set('startTime', event.target.value)}
              />
            </Field>
            <Field label="À">
              <Input
                type="time"
                value={values.endTime}
                onChange={(event) => draft.set('endTime', event.target.value)}
              />
            </Field>
          </div>
          {endsNextDay(values.startTime, values.endTime) && (
            <p className="mx-1 text-body text-muted-foreground">Se termine le lendemain.</p>
          )}
        </SettingsSection>

        <SettingsSection title="Jours">
          <DayToggles
            days={values.days}
            onToggle={(day) =>
              draft.set(
                'days',
                values.days.includes(day)
                  ? values.days.filter((value) => value !== day)
                  : [...values.days, day],
              )
            }
          />
        </SettingsSection>

        <TargetChecks
          label={TARGETS_LABEL[type.targetKind]}
          options={targetOptions[type.targetKind]}
          checked={values.targetIds}
          empty={NO_TARGET_TO_CHOOSE[type.targetKind]}
          onToggle={(id) =>
            draft.set(
              'targetIds',
              values.targetIds.includes(id)
                ? values.targetIds.filter((value) => value !== id)
                : [...values.targetIds, id],
            )
          }
        />

        {uido.failure && <ErrorMessage error={uido.failure} />}

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={uido.saving || (rule !== null && !draft.dirty)}
          onClick={() => void save()}
        >
          {uido.saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>

        {rule !== null && (
          <DeleteAction
            label="Supprimer la plage"
            question="Supprimer cette plage ?"
            consequence={`La plage « ${type.name} » de ${formatHouseTime(rule.startTime)} à ${formatHouseTime(rule.endTime)}${
              savedTargets.length > 0 ? ` sur ${savedTargets.join(', ')}` : ''
            } ne s’appliquera plus.`}
            confirming={uido.confirmDelete}
            deleting={uido.deleting}
            onAsk={presenter.onAskDelete}
            onConfirm={() => remove(rule.id)}
            onCancel={presenter.onCancelDelete}
          />
        )}
      </SettingsPage>
    </Page>
  )
}

/** The editor names itself and gives its own way back to the week (OWN_HEADER). */
function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} />
      {children}
    </div>
  )
}
