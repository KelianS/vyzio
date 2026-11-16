import type { HubAction } from './hub.actions'
import type { HubUido } from './hub.uido'

export function hubReducer(state: HubUido, action: HubAction): HubUido {
  switch (action.type) {
    case 'SILENCE_READ':
      return { ...state, silence: action.silence, silenceSettled: true }
    case 'SILENCE_READ_FAILED':
      return { ...state, silenceSettled: true }
    case 'SILENCE_SHEET_SET':
      return { ...state, silenceSheetOpen: action.open }
    // One tap starts it and closes the sheet: nothing to confirm (NOTIF-34).
    case 'SILENCE_CHANGE_STARTED':
      return { ...state, silenceBusy: true, silenceSheetOpen: false }
    case 'SILENCE_CHANGED':
      return { ...state, silenceBusy: false, silence: action.silence }
    case 'SILENCE_CHANGE_FAILED':
      return { ...state, silenceBusy: false }
    case 'OVERVIEW_LOADED':
      return { ...state, notificationsToConfigure: action.activeChannels === 0 }
    case 'DETECTIONS_COUNTED':
      return { ...state, recentDetections: action.recent }
    // One tap cuts and closes the sheet: the option was the confirmation (PRIV-22).
    case 'PRIVACY_STARTED':
      return {
        ...state,
        cutSheetOpen: false,
        privacyBusyIds: [...state.privacyBusyIds, ...action.cameraIds],
      }
    case 'PRIVACY_FINISHED':
      return {
        ...state,
        privacyBusyIds: state.privacyBusyIds.filter((id) => !action.cameraIds.includes(id)),
      }
    case 'CUT_READ':
      return { ...state, cut: action.cut }
    case 'CUT_SHEET_SET':
      return { ...state, cutSheetOpen: action.open }
  }
}
