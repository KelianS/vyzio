import type { Page } from '@playwright/test'

/** What every screen owes the redesign's foundation, measured with every fold open. */
export interface FoundationReport {
  ground: string
  fonts: string[]
  sizes: string[]
  /** Controls a finger cannot reach, with their size: empty when every one reaches 44 px. */
  smallControls: string[]
}

const CONTROLS =
  'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=switch], [role=checkbox], [role=combobox], [role=tab], [role=slider]'

/**
 * Reads the ground, the font families and sizes of every visible text, and the reach of every
 * control: its own box, its label's, or the hit area its `::after` draws around it. Two kinds of
 * control are exempt, as WCAG 2.5.8 exempts them: a link inside a sentence, and a week block whose
 * range also opens from its row below (`Semaine`).
 */
export async function probeFoundation(page: Page): Promise<FoundationReport> {
  return page.evaluate(
    ({ controls }) => {
      document.querySelectorAll('details').forEach((details) => (details.open = true))

      const smallControls: string[] = []
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(controls))) {
        const box = el.getBoundingClientRect()
        if (box.width === 0 || box.height === 0) continue
        if (el.closest('ol[aria-label="Semaine"]')) continue
        const inSentence =
          el.tagName === 'A' &&
          getComputedStyle(el).display === 'inline' &&
          (el.parentElement?.textContent ?? '').trim().length > (el.textContent ?? '').trim().length
        if (inSentence) continue

        const label = el.closest('label')?.getBoundingClientRect()
        const after = getComputedStyle(el, '::after')
        const grow = after.position === 'absolute' ? -parseFloat(after.top) || 0 : 0
        const height = Math.max(box.height + 2 * grow, label?.height ?? 0)
        const width = Math.max(box.width + 2 * grow, label?.width ?? 0)
        if (height < 43.5 || width < 43.5) {
          const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)
          smallControls.push(`${Math.round(width)}x${Math.round(height)} ${el.tagName} "${name}"`)
        }
      }

      const fonts = new Set<string>()
      const sizes = new Set<string>()
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const speaks = Array.from(el.childNodes).some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        )
        // What is copied or typed as is (a diagnostic line, a code, a command) is monospace on purpose.
        if (
          !speaks ||
          el.getBoundingClientRect().width === 0 ||
          el.closest('.sr-only, .font-mono, code')
        )
          continue
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden') continue
        fonts.add(style.fontFamily.split(',')[0].replaceAll('"', ''))
        sizes.add(style.fontSize)
      }

      return {
        ground: getComputedStyle(document.body).backgroundColor,
        fonts: [...fonts].sort(),
        sizes: [...sizes].sort(),
        smallControls,
      }
    },
    { controls: CONTROLS },
  )
}
