import type { ToastTone } from '../components/toast'
import { toastError } from '../errors/app_error'
import { toAppError } from '../errors/to_app_error'
import type { CheckDetectionClip } from '../../domain/usecases/check_detection_clip.use_case'

const UNREADABLE = 'La vidéo n’a pas pu être lue.'

/** A player that fails asks why: a video erased with another detection is said, not shown broken (HIST-11). */
export async function explainVideoFailure(
  checkDetectionClip: CheckDetectionClip,
  eventId: string,
  onClipGone: () => void,
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void,
): Promise<void> {
  try {
    if (await checkDetectionClip.execute(eventId)) toast(UNREADABLE, 'error')
    else onClipGone()
  } catch (e) {
    toastError(toast, toAppError(e), UNREADABLE)
  }
}
