import type { ReactNode } from 'react'

/**
 * The surface of a settings page.
 *
 * **It carries no title**, and that is the rule: whatever leads to the page has
 * already named it - the tab stays visible right above, the section entry stays
 * highlighted beside it. Repeating it added one title per level, up to crowning
 * a single setting with three identical names.
 *
 * The name of the page is therefore rendered **once**, by the shell holding it
 * (`SettingsView`, or the camera header).
 */
export function SettingsPage({ lede, children }: { lede?: string; children: ReactNode }) {
  return (
    <section className="rounded-card bg-card p-5 text-card-foreground shadow-[var(--shadow-soft)] sm:p-6">
      {lede && <p className="mb-5 text-sm text-muted-foreground">{lede}</p>}
      {children}
    </section>
  )
}

/**
 * A group **inside** a page, when the page really covers several subjects.
 *
 * A group title is justified when it names something other than the page;
 * otherwise it is a page that should be opened, not a frame that should be added.
 * It renders more quietly than a page title, but in the **serif of titles**: that
 * is what keeps it from looking like a setting label, which is never a title.
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
    <section className="mt-8 border-t border-border pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <h2 className="font-serif text-2xl">{title}</h2>
      {lede && <p className="mt-1 mb-4 text-sm text-muted-foreground">{lede}</p>}
      <div className={lede ? undefined : 'mt-4'}>{children}</div>
    </section>
  )
}
