import { CreateScheduleRule } from '../../domain/usecases/create_schedule_rule.use_case'
import { DeleteScheduleRule } from '../../domain/usecases/delete_schedule_rule.use_case'
import { GetScheduleRule } from '../../domain/usecases/get_schedule_rule.use_case'
import { ListScheduleRules } from '../../domain/usecases/list_schedule_rules.use_case'
import { UpdateScheduleRule } from '../../domain/usecases/update_schedule_rule.use_case'
import type { ScheduleRepository } from '../../domain/ports/schedule.port'

export interface SchedulesContainer {
  listScheduleRules: ListScheduleRules
  getScheduleRule: GetScheduleRule
  createScheduleRule: CreateScheduleRule
  updateScheduleRule: UpdateScheduleRule
  deleteScheduleRule: DeleteScheduleRule
}

export function makeSchedulesContainer(scheduleRepository: ScheduleRepository): SchedulesContainer {
  return {
    listScheduleRules: new ListScheduleRules(scheduleRepository),
    getScheduleRule: new GetScheduleRule(scheduleRepository),
    createScheduleRule: new CreateScheduleRule(scheduleRepository),
    updateScheduleRule: new UpdateScheduleRule(scheduleRepository),
    deleteScheduleRule: new DeleteScheduleRule(scheduleRepository),
  }
}
