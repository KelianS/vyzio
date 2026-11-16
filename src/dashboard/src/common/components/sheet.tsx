import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { motionValue, type MotionValue } from 'motion/react'
import { Button } from '../ui/button'
import { cn } from '../ui/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { holdsItsOwnDrag, projection, rubberBand, useFingerDrag } from '../motion/gesture'
import { paintOn, translation } from '../motion/ghost'
import { prefersReducedMotion, springTo } from '../motion/springs'
import { PressableSurface } from './pressable'

/** What a row does: a tap on it, or a field it holds (a chosen day). */
type SheetOptionInput = { onPick: () => void; field?: never } | { field: ReactNode; onPick?: never }

/** One choice of a sheet: a tap applies it, nothing to confirm. */
export type SheetOption = SheetOptionInput & {
  key: string
  title: string
  /** A quieter second line, only when the title leaves something out. */
  detail?: string
  /** What the option is, drawn before its title. */
  icon?: ReactNode
  /** The axis it belongs to, for a choice along several (a filter): consecutive ones share a heading. */
  group?: string
  /** The current choice, checked. */
  selected?: boolean
  /** It destroys something, after its own confirmation: in coral ink. */
  destructive?: boolean
}

const ROW_CLASS = 'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left'

/** Consecutive options of one axis, under its heading. */
function groupsOf(options: readonly SheetOption[]): { group?: string; options: SheetOption[] }[] {
  const groups: { group?: string; options: SheetOption[] }[] = []
  for (const option of options) {
    const last = groups.at(-1)
    if (last && last.group === option.group) last.options.push(option)
    else groups.push({ group: option.group, options: [option] })
  }
  return groups
}

interface SheetMotion {
  /** How far the sheet stands below its open place, in pixels. */
  readonly y: MotionValue<number>
  readonly opacity: MotionValue<number>
}

/** Paints the sheet and its backdrop from its motion: the backdrop clears as the sheet goes down. */
function paintSheet(sheet: HTMLElement, backdrop: HTMLElement | null, { y, opacity }: SheetMotion) {
  return paintOn([y, opacity], () => {
    sheet.style.transform = translation(0, y.get())
    sheet.style.opacity = opacity.get() === 1 ? '' : String(opacity.get())
    if (!backdrop) return
    const lowered = Math.min(1, Math.max(0, y.get() / Math.max(1, sheet.offsetHeight)))
    backdrop.style.opacity = String(opacity.get() * (1 - lowered))
  })
}

/** Where a sheet goes when it leaves: below its own height, or nowhere under reduced motion. */
function leave(sheet: HTMLElement, motion: SheetMotion, velocity?: number) {
  return prefersReducedMotion()
    ? springTo(motion.opacity, 0, 'departure')
    : springTo(motion.y, Math.max(sheet.offsetHeight, 1), 'departure', velocity)
}

/** Plays the leaving of a sheet its caller removed, on a lifeless copy of it and its backdrop. */
function leaveAsGhost(sheet: HTMLElement, backdrop: HTMLElement | null, from: SheetMotion) {
  const copies = [backdrop, sheet].flatMap((part) => {
    if (!part) return []
    const copy = part.cloneNode(true) as HTMLElement
    copy.setAttribute('aria-hidden', 'true')
    copy.setAttribute('inert', '')
    copy.style.pointerEvents = 'none'
    document.body.append(copy)
    return [copy]
  })
  const [sheetCopy, backdropCopy] = backdrop ? [copies[1], copies[0]] : [copies[0], null]
  const motion = { y: motionValue(from.y.get()), opacity: motionValue(from.opacity.get()) }
  const stop = paintSheet(sheetCopy, backdropCopy, motion)
  void leave(sheetCopy, motion).then(() => {
    stop()
    copies.forEach((copy) => copy.remove())
  })
}

/**
 * A quick, reversible choice rising from the bottom edge (DESIGN SYSTEM § Sheets): a title, the
 * effect in one line, the options as rows, `Annuler` last. Its caller mounts it while it shows.
 * A sheet whose rows are checked and unchecked (`checkable`) stays open, closed by `Fermer`.
 * A finger drags it down to close it; however it closes, it leaves downwards.
 */
export function Sheet({
  title,
  effect,
  options,
  checkable = false,
  onClose,
}: {
  title: string
  effect: ReactNode
  options: readonly SheetOption[]
  checkable?: boolean
  onClose: () => void
}) {
  const [sheet, setSheet] = useState<HTMLDivElement | null>(null)
  const [motion] = useState<SheetMotion>(() => ({ y: motionValue(0), opacity: motionValue(1) }))
  // Each close is numbered: a finger catching the sheet mid-way cancels the one under way.
  const closing = useRef(0)
  const handedBack = useRef(false)
  const grabbed = useRef(0)

  useLayoutEffect(() => {
    if (!sheet) return
    const backdrop = sheet.previousElementSibling as HTMLElement | null
    const stop = paintSheet(sheet, backdrop, motion)
    // Under reduced motion the primitive's own fade brings it in.
    if (!prefersReducedMotion()) {
      motion.y.jump(sheet.offsetHeight || window.innerHeight)
      void springTo(motion.y, 0, 'arrival')
    }
    // A sheet that fits is dragged from anywhere; one that scrolls, from its head only.
    const fit = new ResizeObserver(() => {
      sheet.dataset.fits = String(sheet.scrollHeight <= sheet.clientHeight + 1)
    })
    fit.observe(sheet)
    return () => {
      stop()
      fit.disconnect()
      // Still on the page once the cleanup is over: a remount, not a removal.
      queueMicrotask(() => {
        if (!sheet.isConnected && !handedBack.current) leaveAsGhost(sheet, backdrop, motion)
      })
    }
  }, [sheet, motion])

  const close = (velocity?: number) => {
    if (!sheet) return
    const ticket = ++closing.current
    void leave(sheet, motion, velocity).then(() => {
      if (ticket !== closing.current || handedBack.current) return
      handedBack.current = true
      onClose()
    })
  }

  const drag = useFingerDrag('y', {
    canStart: (target) =>
      !holdsItsOwnDrag(target) &&
      (sheet?.dataset.fits === 'true' ||
        (target instanceof Element && target.closest('[data-sheet-head]') !== null)),
    onStart: () => {
      closing.current++
      motion.y.stop()
      motion.opacity.stop()
      motion.opacity.jump(1)
      grabbed.current = motion.y.get()
    },
    onMove: (offset) => {
      const next = grabbed.current + offset
      const height = Math.max(sheet?.offsetHeight ?? 1, 1)
      // Upwards a sheet has nowhere to go: it stretches, harder and harder, never under reduced motion.
      motion.y.set(next >= 0 ? next : prefersReducedMotion() ? 0 : rubberBand(next, height))
    },
    onEnd: (_offset, velocity) => {
      const height = Math.max(sheet?.offsetHeight ?? 1, 1)
      if (motion.y.get() + projection(velocity) > height / 2) close(velocity)
      else void springTo(motion.y, 0, 'arrival', velocity)
    },
  })

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent
        ref={setSheet}
        showCloseButton={false}
        {...drag}
        // Anchored to the bottom edge; its springs, not the primitive's keyframes, move it.
        className="[--tw-enter-scale:1]! [--tw-exit-scale:1]! top-auto bottom-0 max-h-[90dvh] overflow-y-auto left-1/2 flex max-w-none -translate-x-1/2 translate-y-0 flex-col gap-4 rounded-t-panel rounded-b-none px-4 pt-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] data-[fits=true]:touch-none motion-safe:animate-none! sm:max-w-lg"
      >
        <div data-sheet-head className="flex touch-none flex-col gap-1 px-1">
          <DialogTitle className="text-title font-bold">{title}</DialogTitle>
          <DialogDescription className="text-body text-muted-foreground">
            {effect}
          </DialogDescription>
        </div>
        {groupsOf(options).map(({ group, options: ofGroup }) => (
          <section key={group ?? ''} aria-label={group} className="flex flex-col gap-2">
            {group && (
              <h3 className="ml-1 text-label font-semibold text-muted-foreground">{group}</h3>
            )}
            <ul className="divide-y divide-border overflow-hidden rounded-card bg-secondary">
              {ofGroup.map((option) => {
                const content = (
                  <>
                    {option.icon}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn(
                          'text-row font-medium',
                          option.destructive && 'text-destructive',
                        )}
                      >
                        {option.title}
                      </span>
                      {option.detail && (
                        <span className="text-body text-muted-foreground">{option.detail}</span>
                      )}
                    </span>
                  </>
                )
                const check = option.selected && (
                  <Check className="size-5 shrink-0" aria-hidden="true" />
                )
                return (
                  <li key={option.key}>
                    {option.field ? (
                      // A field takes its own taps: the row is its label, not a button.
                      <label className={cn(ROW_CLASS, 'focus-within:bg-accent')}>
                        {content}
                        {option.field}
                        {check}
                      </label>
                    ) : (
                      <PressableSurface>
                        <button
                          type="button"
                          aria-current={!checkable && option.selected ? 'true' : undefined}
                          aria-pressed={checkable ? Boolean(option.selected) : undefined}
                          className={cn(
                            ROW_CLASS,
                            'outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
                          )}
                          onClick={option.onPick}
                        >
                          {content}
                          {check}
                        </button>
                      </PressableSurface>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        <Button type="button" variant="ghost" className="text-ink-muted" onClick={() => close()}>
          {checkable ? 'Fermer' : 'Annuler'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
