import { useRef, useState } from 'react'
import { Crosshair, MapPin, Plus } from 'lucide-react'
import { cn } from '../../../common/ui/utils'
import { ConfirmModal } from '../../../common/components/confirm_modal'
import { ReadFailure } from '../../../common/components/error_message'
import { PressableControl } from '../../../common/components/pressable'
import { SecondaryButton } from '../../../common/components/secondary_button'
import type { PtzPreset } from '../../../domain/entities/ptz_preset.entity'
import { POSITIONS_UNREAD } from '../../cameras/cameras.formatters'
import { presetLabel } from '../live_view.formatters'
import type { LiveViewUido, PresetActivity } from '../live_view.uido'
import { fading } from '../../../common/motion/fading'
import type { PadVariant } from './ptz_pad'

const ALL_PRESET_IDS = [1, 2, 3, 4]

const BUSY: Record<PresetActivity, boolean> = { idle: false, saving: true, going: true }

// On a saved position a tap goes there and a long press redefines it; "Ajouter" saves on a tap.
const LONG_PRESS_MS = 600

const ADD_TITLE = 'Enregistrer la position actuelle ici'

/** In the page, or laid over the picture where the names read on any image. */
const TILES: Record<PadVariant, { row: string; tile: string; frame: string; messages: string }> = {
  solid: {
    row: 'flex snap-x snap-mandatory scroll-px-1 gap-2.5 overflow-x-auto overscroll-x-contain px-1 pb-1',
    tile: 'w-26',
    frame: 'h-16 bg-picture',
    messages: 'flex flex-col gap-2',
  },
  glass: {
    row: 'flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain',
    tile: 'w-24',
    frame: 'h-13.5 bg-glass',
    messages: 'flex max-w-md flex-col gap-2 rounded-card bg-card p-2',
  },
}

/** What a tile says on hover, by whether its slot holds a position and has its thumbnail (PTZ-07). */
function tileTitle(preset: PtzPreset): string {
  return preset.thumbnail
    ? `${preset.label} (appui : y aller, appui long : redéfinir ici)`
    : `${preset.label} (appui : y aller et prendre sa miniature, appui long : redéfinir ici)`
}

/** The question opens under the finger: the menu the release then asks for lands on it, not on the tile. */
function swallowNextContextMenu() {
  const swallow = (e: Event) => e.preventDefault()
  document.addEventListener('contextmenu', swallow, { capture: true, once: true })
  setTimeout(() => document.removeEventListener('contextmenu', swallow, { capture: true }), 2_000)
}

/** A press that tells a tap from a long press, each with its own effect. */
function usePress(onTap: () => void, onLongPress: (() => void) | null) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  const end = (tap: boolean) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (tap && !longPressed.current) onTap()
  }

  const longPress = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    longPressed.current = true
    swallowNextContextMenu()
    onLongPress?.()
  }

  return {
    // Pointer events only: a touch also emulates mouse events, which would press the tile twice.
    onPointerDown: (e: { button: number }) => {
      if (e.button !== 0) return
      longPressed.current = false
      if (!onLongPress) return
      timer.current = setTimeout(longPress, LONG_PRESS_MS)
    },
    onPointerUp: () => end(true),
    // A swipe along the row is the browser's: it cancels the press, so a scroll never saves.
    onPointerCancel: () => end(false),
    onPointerLeave: () => end(false),
    // The browser's own long press on a picture comes first and cancels the touch: it is ours.
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault()
      if (timer.current) longPress()
    },
  }
}

function PositionTile({
  variant,
  preset,
  active,
  thumbSrc,
  busy,
  editable,
  onGoTo,
  onRedefine,
}: {
  variant: PadVariant
  preset: PtzPreset
  active: boolean
  thumbSrc: string | null
  busy: boolean
  editable: boolean
  onGoTo: () => void
  onRedefine: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const look = TILES[variant]
  const press = usePress(onGoTo, editable ? onRedefine : null)

  return (
    <PressableControl>
      <button
        type="button"
        disabled={busy}
        aria-pressed={active}
        title={tileTitle(preset)}
        {...press}
        className={cn(
          'group flex shrink-0 snap-start touch-pan-x flex-col gap-1.5 text-left outline-none disabled:opacity-60',
          look.tile,
        )}
      >
        <span
          className={cn(
            'relative flex items-center justify-center overflow-hidden rounded-md group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50',
            look.frame,
            active && 'outline-2 -outline-offset-2 outline-foreground',
          )}
        >
          {thumbSrc ? (
            <img
              key={thumbSrc}
              src={thumbSrc}
              alt=""
              draggable={false}
              className="pointer-events-none size-full object-cover"
              style={loaded ? undefined : { visibility: 'hidden' }}
              onLoad={() => setLoaded(true)}
              // A missing thumbnail leaves the frame empty: the name still says where it goes.
              onError={() => setLoaded(false)}
            />
          ) : (
            // Held by the camera before any thumbnail: a position, never the sign of an empty slot (PTZ-14).
            <MapPin className="size-5 text-ink-muted" aria-hidden="true" />
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-picture/60 text-label text-ink-muted">
              …
            </span>
          )}
        </span>
        <span
          className={cn(
            'truncate text-label',
            active ? 'font-semibold text-foreground' : 'font-medium text-ink-muted',
          )}
        >
          {preset.label}
        </span>
      </button>
    </PressableControl>
  )
}

function AddTile({ busy, onSave }: { busy: boolean; onSave: () => void }) {
  const press = usePress(onSave, null)
  return (
    <PressableControl>
      <button
        type="button"
        disabled={busy}
        title={ADD_TITLE}
        {...press}
        className="group flex w-26 shrink-0 snap-start touch-pan-x flex-col gap-1.5 text-left outline-none disabled:opacity-60"
      >
        <span className="flex h-16 items-center justify-center rounded-md border-[1.5px] border-dashed border-input bg-card text-muted-foreground group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50">
          {busy ? '…' : <Plus className="size-5" aria-hidden="true" />}
        </span>
        <span className="text-label font-medium text-muted-foreground">Ajouter</span>
      </button>
    </PressableControl>
  )
}

/** The saved positions as named thumbnails, then "Ajouter" for the first free slot (PTZ-07). */
export function PtzPositions({
  variant,
  shown,
  cameraId,
  apiBaseUrl,
  uido,
  onGoTo,
  onSave,
  onAskOverride,
  onCancelOverride,
  onConfirmOverride,
  onCalibrate,
  onRetryPresets,
}: {
  variant: PadVariant
  /** Over the picture the tiles fade; a line explaining a state never does (LIVE-10). */
  shown: boolean
  cameraId: string
  apiBaseUrl: string
  uido: LiveViewUido
  onGoTo: (presetId: number) => void
  onSave: (presetId: number) => void
  onAskOverride: (presetId: number) => void
  onCancelOverride: () => void
  onConfirmOverride: (presetId: number) => Promise<void>
  onCalibrate: () => void
  onRetryPresets: () => void
}) {
  const { presets, calibrated, activePresetId } = uido
  const look = TILES[variant]
  const fade = fading(shown)
  const messages = uido.presetsError !== null || (presets !== null && !calibrated)
  const held = presets ?? []
  const free = ALL_PRESET_IDS.find((id) => !held.some((p) => p.presetId === id))
  // In the page only: over the picture the thumbnails stay a way to go somewhere (LIVE-22).
  const adds = variant === 'solid' && calibrated && free !== undefined

  const overridePreset =
    uido.overridePresetId !== null
      ? held.find((p) => p.presetId === uido.overridePresetId)
      : undefined

  return (
    <div className="flex flex-col gap-2">
      {messages && (
        <div className={look.messages}>
          {uido.presetsError && (
            <ReadFailure
              error={uido.presetsError}
              onRetry={onRetryPresets}
              subject={POSITIONS_UNREAD}
            />
          )}

          {/* Without a reference the saved positions are inert, and nothing else said so. */}
          {presets && !calibrated && (
            <div className="flex flex-col items-start gap-2 rounded-inset bg-card p-3">
              <p className="text-body text-muted-foreground">
                Cette caméra n’a pas de position de référence : les positions enregistrées ne sont
                pas utilisables tant qu’elle n’est pas calibrée.
              </p>
              <SecondaryButton
                icon={Crosshair}
                type="button"
                size="sm"
                disabled={uido.calibrating}
                onClick={onCalibrate}
              >
                {uido.calibrating ? 'Calibration en cours…' : 'Calibrer maintenant'}
              </SecondaryButton>
            </div>
          )}
        </div>
      )}

      {/* No slot is offered while the camera has not said which ones it holds (ADR-09). */}
      {presets && (held.length > 0 || adds) && (
        <div {...fade} className={cn(look.row, fade.className)}>
          {ALL_PRESET_IDS.map((presetId) => {
            const preset = held.find((p) => p.presetId === presetId)
            if (!preset) return null
            const version = uido.thumbnailVersions[presetId] ?? 1
            return (
              <PositionTile
                key={presetId}
                variant={variant}
                preset={{ ...preset, label: presetLabel(held, presetId) }}
                active={activePresetId === presetId}
                thumbSrc={
                  preset.thumbnail
                    ? `${apiBaseUrl}/api/cameras/${cameraId}/ptz/presets/${presetId}/thumbnail?t=${version}`
                    : null
                }
                busy={BUSY[uido.activities[presetId] ?? 'idle']}
                editable={calibrated}
                onGoTo={() => onGoTo(presetId)}
                onRedefine={() => onAskOverride(presetId)}
              />
            )
          })}
          {adds && (
            <AddTile busy={BUSY[uido.activities[free] ?? 'idle']} onSave={() => onSave(free)} />
          )}
        </div>
      )}

      {overridePreset && (
        <ConfirmModal
          title="Redéfinir cette position ?"
          body={`La position actuelle de la caméra va remplacer celle enregistrée pour « ${overridePreset.label} ».`}
          confirmLabel="Redéfinir"
          tone="warn"
          onConfirm={() => onConfirmOverride(overridePreset.presetId)}
          onCancel={onCancelOverride}
        />
      )}
    </div>
  )
}
