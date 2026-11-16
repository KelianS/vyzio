import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import type { DetectionHistoryAction } from './detection_history.actions'
import { ANY_DAY } from './day_filter'
import type { DetectionHistoryUido } from './detection_history.uido'

/**
 * Surveillance being stopped and a read failure are not said the same way: without surveillance
 * there is no history at all, and keeping quiet would read as "no detection" (principle #4).
 */
export function historyFailureSubject(error: AppError): string {
  return error.kind === AppErrorKind.SurveillanceDown
    ? 'La surveillance ne répond pas : tant qu’elle est arrêtée, il n’y a pas de détection à afficher.'
    : 'Les détections n’ont pas pu être lues.'
}

/** The clip in the player: the one chosen, else the most recent (HIST-18). */
export function playingClip(state: DetectionHistoryUido): DetectionEvent | null {
  return state.items.find((item) => item.eventId === state.playingId) ?? state.items[0] ?? null
}

/** The clip after this one in the list, older, across days; none after the last. */
function nextOf(items: readonly DetectionEvent[], eventId: string): DetectionEvent | null {
  const index = items.findIndex((item) => item.eventId === eventId)
  return index < 0 ? null : (items[index + 1] ?? null)
}

/**
 * Changing a filter reads again from the start: a cursor does not outlive the criteria that produced
 * it. The sheet stays open, several values being checked one after another.
 */
const REFILTERED: Pick<DetectionHistoryUido, 'items' | 'nextCursor' | 'loaded' | 'playingId'> = {
  items: [],
  nextCursor: null,
  loaded: false,
  playingId: null,
}

export function detectionHistoryReducer(
  state: DetectionHistoryUido,
  action: DetectionHistoryAction,
): DetectionHistoryUido {
  switch (action.type) {
    case 'PROFILES_LOADED':
      return { ...state, profiles: action.profiles }
    case 'LABELS_LOADED':
      return { ...state, detectionLabels: action.labels }

    case 'HISTORY_LOAD_STARTED':
      // A new list makes any older page still on its way moot.
      return { ...state, error: null, loadingMore: false }
    case 'HISTORY_LOAD_SUCCEEDED':
      return {
        ...state,
        loaded: true,
        items: action.page.items,
        nextCursor: action.page.nextCursor,
      }
    case 'HISTORY_LOAD_FAILED':
      return { ...state, error: action.error }

    case 'HISTORY_MORE_STARTED':
      return { ...state, loadingMore: true }
    case 'HISTORY_MORE_SUCCEEDED':
      return {
        ...state,
        loadingMore: false,
        items: [...state.items, ...action.page.items],
        nextCursor: action.page.nextCursor,
      }
    case 'HISTORY_MORE_FAILED':
      return { ...state, loadingMore: false }

    case 'FILTER_TOGGLED': {
      const checked = state.filters[action.axis]
      const values = checked.includes(action.value)
        ? checked.filter((value) => value !== action.value)
        : [...checked, action.value]
      return { ...state, ...REFILTERED, filters: { ...state.filters, [action.axis]: values } }
    }
    case 'FILTER_CLEARED':
      return { ...state, ...REFILTERED, filters: { ...state.filters, [action.axis]: [] } }
    case 'FILTER_DAY_SET':
      return { ...state, ...REFILTERED, filterDay: action.day }
    case 'FILTERS_RESET':
      return {
        ...state,
        ...REFILTERED,
        filters: { camera: [], profile: [], label: [] },
        filterDay: ANY_DAY,
      }

    case 'CLIP_PLAYED':
      return { ...state, playingId: action.eventId }
    // The next clip plays by itself, with nothing to set; after the last, the player rests (HIST-18).
    // While its actions are open the clip holds still, so they never land on the next one.
    case 'CLIP_ENDED': {
      const next = nextOf(state.items, action.eventId)
      return next && state.sheet !== 'actions' && state.sheet !== 'identity'
        ? { ...state, playingId: next.eventId }
        : state
    }

    case 'SHEET_OPENED':
      return { ...state, sheet: action.sheet }
    case 'SHEET_CLOSED':
      return { ...state, sheet: null }

    // The correction shows without waiting for the re-read: Frigate takes a few seconds to
    // propagate it, and a screen that does not move suggests the gesture failed (ADR-12).
    case 'CORRECT_SUCCEEDED':
      return {
        ...state,
        items: state.items.map((item) =>
          item.eventId === action.eventId
            ? { ...item, identity: action.identity, profileId: action.profileId }
            : item,
        ),
      }

    case 'DELETE_ASKED':
      return { ...state, sheet: null, deletingEventId: action.eventId }
    case 'DELETE_DISMISSED':
      return { ...state, deletingEventId: null }
    // Gone from the surveillance, so gone from the list without a re-read; the player moves to the next clip.
    case 'DELETE_SUCCEEDED': {
      const playing = playingClip(state)?.eventId === action.eventId
      return {
        ...state,
        deletingEventId: null,
        playingId: playing
          ? (nextOf(state.items, action.eventId)?.eventId ?? null)
          : state.playingId,
        items: state.items.filter((item) => item.eventId !== action.eventId),
      }
    }
    case 'CLIP_GONE':
      return { ...state, clipGoneEventId: action.eventId }
  }
}
