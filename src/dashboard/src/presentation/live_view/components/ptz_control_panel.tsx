import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight, MapPin, Plus } from 'lucide-react'
import { cn } from '../../../common/ui/utils'
import { Button } from '../../../common/ui/button'
import { ConfirmModal } from '../../../common/components/confirm_modal'
import { ReadFailure } from '../../../common/components/error_message'
import { isReservedPreset, type PtzPreset } from '../../../domain/entities/ptz_preset.entity'
import { POSITIONS_UNREAD } from '../../cameras/cameras.formatters'
import { presetLabel } from '../live_view.formatters'
import type { LiveViewUido, PresetActivity, PtzDirection } from '../live_view.uido'
import type { LiveLayout } from '../live_layout'
import { fading } from './live_control'

const ALL_PRESET_IDS = [1, 2, 3, 4]

const BUSY: Record<PresetActivity, boolean> = { idle: false, saving: true, going: true }

/** Where each part sits: below or beside the picture, or laid over it in landscape (LIVE-09, LIVE-10). */
const PLACE: Record<
  LiveLayout,
  {
    panel: string
    joystick: string
    pad: string
    button: string
    icon: string
    positions: string
    messages: string
    tiles: string
  }
> = {
  // A fixed, comfortable pad with the positions right under it, both centred in the room left.
  portrait: {
    panel: 'flex flex-1 flex-col items-center justify-center gap-5',
    joystick: '',
    pad: 'size-[max(7rem,min(40vw,10rem))] bg-card',
    button: 'size-10',
    icon: 'size-5',
    positions: 'flex w-full flex-col items-center gap-2',
    messages: 'flex flex-col items-center gap-2',
    tiles: 'flex max-w-full gap-3 overflow-x-auto px-1 pb-1',
  },
  landscape: {
    panel: 'pointer-events-none absolute inset-0',
    joystick:
      'pointer-events-auto absolute top-1/2 right-[max(1rem,env(safe-area-inset-right))] -translate-y-1/2',
    pad: 'size-[116px] bg-card/60',
    button: 'size-[34px]',
    icon: 'size-4',
    positions:
      'absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100%-18rem)] -translate-x-1/2 flex-col items-center gap-2',
    messages: 'pointer-events-auto flex flex-col gap-2 rounded-card bg-card p-2',
    tiles: 'pointer-events-auto flex gap-3 overflow-x-auto rounded-card bg-card/85 p-2',
  },
  wide: {
    panel: 'flex flex-col items-center gap-6',
    joystick: '',
    pad: 'size-40 bg-card',
    button: 'size-10',
    icon: 'size-5',
    positions: 'flex w-full flex-col items-center gap-2',
    messages: 'flex flex-col items-center gap-2',
    tiles: 'flex flex-wrap justify-center gap-3',
  },
}

const EDGE_POSITION: Record<PtzDirection, string> = {
  Up: 'top-0.5 left-1/2 -translate-x-1/2',
  Down: 'bottom-0.5 left-1/2 -translate-x-1/2',
  Left: 'left-0.5 top-1/2 -translate-y-1/2',
  Right: 'right-0.5 top-1/2 -translate-y-1/2',
}

function DirButton({
  buttonSize,
  edge,
  title,
  children,
  ...handlers
}: {
  buttonSize: string
  edge: PtzDirection
  title: string
  children: ReactNode
  onMouseDown: () => void
  onMouseUp: () => void
  onMouseLeave: () => void
  onTouchStart: (e: TouchEvent) => void
  onTouchEnd: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      {...handlers}
      className={cn(
        buttonSize,
        'absolute flex items-center justify-center rounded-full bg-muted text-foreground transition-colors',
        'hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground',
        EDGE_POSITION[edge],
      )}
    >
      {children}
    </button>
  )
}

// On a saved position a tap goes there and a long press redefines it; on an empty one a tap saves it.
const LONG_PRESS_MS = 600

/** What a tile says on hover, by whether its slot holds a position and has its thumbnail (PTZ-07). */
function tileTitle(preset: PtzPreset | undefined, editable: boolean): string {
  if (!preset) return editable ? 'Enregistrer la position actuelle ici' : 'Non définie'
  return preset.thumbnail
    ? `${preset.label} (appui : y aller, appui long : redéfinir ici)`
    : `${preset.label} (appui : y aller et prendre sa miniature, appui long : redéfinir ici)`
}

function PresetTile({
  preset,
  reserved,
  active,
  thumbSrc,
  thumbLoaded,
  onThumbLoad,
  state,
  editable,
  onGoto,
  onSave,
}: {
  preset: PtzPreset | undefined
  reserved: boolean
  active: boolean
  thumbSrc: string | null
  thumbLoaded: boolean
  onThumbLoad: () => void
  state: PresetActivity
  editable: boolean
  onGoto: () => void
  onSave: () => void
}) {
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressedRef = useRef(false)

  function start() {
    if (!editable || !preset) return
    longPressedRef.current = false
    pressTimerRef.current = setTimeout(() => {
      longPressedRef.current = true
      onSave()
    }, LONG_PRESS_MS)
  }

  function end(tap: boolean) {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (!tap || longPressedRef.current) return
    if (preset) onGoto()
    else if (editable) onSave()
  }

  return (
    <button
      type="button"
      disabled={BUSY[state] || (!preset && !editable)}
      aria-pressed={preset ? active : undefined}
      title={tileTitle(preset, editable)}
      onMouseDown={start}
      onMouseUp={() => end(true)}
      onMouseLeave={() => end(false)}
      onTouchStart={(e) => {
        e.preventDefault()
        start()
      }}
      onTouchEnd={() => end(true)}
      // The long press is our gesture: without this the mobile browser opens its menu over it.
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'relative size-14 shrink-0 touch-none overflow-hidden rounded-md border bg-muted transition-colors',
        active ? 'border-primary ring-2 ring-primary' : 'border-border',
        'disabled:opacity-60',
      )}
    >
      {!preset ? (
        <Plus className="mx-auto size-4 text-muted-foreground" aria-hidden="true" />
      ) : thumbSrc ? (
        <img
          key={thumbSrc}
          src={thumbSrc}
          alt=""
          className="size-full object-cover"
          style={thumbLoaded ? undefined : { visibility: 'hidden' }}
          onLoad={onThumbLoad}
          onError={() => {}}
        />
      ) : (
        // Held by the camera before any thumbnail: a position, never the sign of an empty slot (PTZ-14).
        <MapPin className="mx-auto size-4 text-foreground" aria-hidden="true" />
      )}
      {reserved && (
        <span
          className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
      {BUSY[state] && (
        <span className="absolute inset-0 flex items-center justify-center bg-surface-inverse/60 text-xs text-surface-inverse-foreground">
          …
        </span>
      )}
    </button>
  )
}

interface PtzControlPanelProps {
  layout: LiveLayout
  /** Over the picture, the joystick and the tiles fade; a line explaining a state never does. */
  shown: boolean
  cameraId: string
  apiBaseUrl: string
  uido: LiveViewUido
  onPress: (direction: PtzDirection) => void
  onRelease: () => void
  onGoTo: (presetId: number) => void
  onSave: (presetId: number) => void
  onAskOverride: (presetId: number) => void
  onCancelOverride: () => void
  onConfirmOverride: (presetId: number) => Promise<void>
  onCalibrate: () => void
  onRetryPresets: () => void
}

/** The joystick and the saved positions, below, beside or over the live picture. */
export function PtzControlPanel({
  layout,
  shown,
  cameraId,
  apiBaseUrl,
  uido,
  onPress,
  onRelease,
  onGoTo,
  onSave,
  onAskOverride,
  onCancelOverride,
  onConfirmOverride,
  onCalibrate,
  onRetryPresets,
}: PtzControlPanelProps) {
  const { presets, calibrated, activePresetId } = uido
  const [loadedThumbs, setLoadedThumbs] = useState<Record<string, boolean>>({})

  const dir = (direction: PtzDirection) => ({
    onMouseDown: () => onPress(direction),
    onMouseUp: onRelease,
    onMouseLeave: onRelease,
    onTouchStart: (e: TouchEvent) => {
      e.preventDefault()
      onPress(direction)
    },
    onTouchEnd: onRelease,
    onTouchCancel: onRelease,
  })

  const overridePreset =
    uido.overridePresetId !== null
      ? presets?.find((p) => p.presetId === uido.overridePresetId)
      : undefined

  const place = PLACE[layout]
  const fade = fading(shown)
  const messages = uido.presetsError !== null || (presets !== null && !calibrated)

  return (
    <div className={place.panel}>
      <div {...fade} className={cn(place.joystick, fade.className)}>
        {/* Its own surface keeps the four directions one control, over the picture or the page. */}
        <div className={cn('relative shrink-0 rounded-full border border-border', place.pad)}>
          <div
            className="absolute inset-[30%] rounded-full border-2 border-background/70"
            aria-hidden="true"
          />
          <DirButton buttonSize={place.button} edge="Up" title="Haut" {...dir('Up')}>
            <ArrowUp className={place.icon} aria-hidden="true" />
          </DirButton>
          <DirButton buttonSize={place.button} edge="Left" title="Gauche" {...dir('Left')}>
            <ArrowLeft className={place.icon} aria-hidden="true" />
          </DirButton>
          <DirButton buttonSize={place.button} edge="Right" title="Droite" {...dir('Right')}>
            <ArrowRight className={place.icon} aria-hidden="true" />
          </DirButton>
          <DirButton buttonSize={place.button} edge="Down" title="Bas" {...dir('Down')}>
            <ArrowDown className={place.icon} aria-hidden="true" />
          </DirButton>
        </div>
      </div>

      <div className={place.positions}>
        {messages && (
          <div className={place.messages}>
            {uido.presetsError && (
              <ReadFailure
                error={uido.presetsError}
                onRetry={onRetryPresets}
                subject={POSITIONS_UNREAD}
              />
            )}

            {/* Without a reference the saved positions are inert, and nothing else said so. */}
            {presets && !calibrated && (
              <div className="flex flex-col items-center gap-2 rounded-inset border border-border bg-muted/40 p-2.5">
                <p className="text-sm text-muted-foreground">
                  Cette caméra n’a pas de position de référence : les positions enregistrées ne sont
                  pas utilisables tant qu’elle n’est pas calibrée.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uido.calibrating}
                  onClick={onCalibrate}
                >
                  {uido.calibrating ? 'Calibration en cours…' : 'Calibrer maintenant'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* No slot is offered while the camera has not said which ones it holds (ADR-09). */}
        {presets && (
          <div {...fade} className={cn(place.tiles, fade.className)}>
            {ALL_PRESET_IDS.map((presetId) => {
              const preset = presets.find((p) => p.presetId === presetId)
              const version = uido.thumbnailVersions[presetId] ?? 1
              const thumbKey = `${presetId}:${version}`
              const thumbSrc = preset?.thumbnail
                ? `${apiBaseUrl}/api/cameras/${cameraId}/ptz/presets/${presetId}/thumbnail?t=${version}`
                : null

              return (
                <div key={presetId} className="flex w-16 shrink-0 flex-col items-center gap-1">
                  <PresetTile
                    preset={preset}
                    reserved={isReservedPreset(presetId)}
                    active={activePresetId === presetId}
                    thumbSrc={thumbSrc}
                    thumbLoaded={!!loadedThumbs[thumbKey]}
                    onThumbLoad={() => setLoadedThumbs((v) => ({ ...v, [thumbKey]: true }))}
                    state={uido.activities[presetId] ?? 'idle'}
                    editable={calibrated}
                    onGoto={() => onGoTo(presetId)}
                    onSave={() => (preset ? onAskOverride(presetId) : onSave(presetId))}
                  />
                  <span
                    className={cn(
                      'w-full text-center text-[11px] leading-tight',
                      activePresetId === presetId
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {presetLabel(presets, presetId)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
