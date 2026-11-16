import type { ReactNode } from 'react'

/**
 * A settings page: its grouped lists on the ground, 24 px apart (DESIGN SYSTEM § Interface tokens).
 *
 * **It carries no title**, and that is the rule: whatever leads to the page has
 * already named it, in the bar. The name of the page is rendered **once**, by the
 * shell holding it (`SettingsView`, or the camera header).
 */
export function SettingsPage({ lede, children }: { lede?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      {lede && <p className="mx-1 text-body text-muted-foreground">{lede}</p>}
      {children}
    </section>
  )
}

/**
 * A group **inside** a page, when the page really covers several subjects: its quiet label
 * above its content, as a grouped list's (DESIGN SYSTEM § Grouped lists).
 *
 * A group title is justified when it names something other than the page;
 * otherwise it is a page that should be opened, not a frame that should be added.
 */
export function SettingsSection({
  title,
  lede,
  children,
}: {
  title: string
  lede?: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="ml-1 text-label font-semibold text-muted-foreground">{title}</h2>
      {lede && <p className="mx-1 text-body text-muted-foreground">{lede}</p>}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}
