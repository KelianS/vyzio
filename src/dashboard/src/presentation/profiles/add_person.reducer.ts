import type { AddPersonAction } from './add_person.actions'
import type { AddPersonUido } from './add_person.uido'

export function addPersonReducer(state: AddPersonUido, action: AddPersonAction): AddPersonUido {
  switch (action.type) {
    case 'NAME_SET':
      return { ...state, form: { ...state.form, name: action.name } }
    case 'CATEGORY_SET':
      return { ...state, form: { ...state.form, category: action.category } }
    case 'ALERT_MODE_SET':
      return { ...state, form: { ...state.form, alertMode: action.alertMode } }
    case 'CREATE_STARTED':
      return { ...state, creating: true }
    case 'CREATE_FINISHED':
      return { ...state, creating: false }
  }
}
