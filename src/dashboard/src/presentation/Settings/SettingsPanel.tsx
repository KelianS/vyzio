import type { ReactNode } from 'react'

/**
 * Cadre commun d'une page de reglages : titre, sous-titre, contenu. Le meme
 * partout, pour que la page se reconnaisse avant d'etre lue.
 */
export function SettingsPanel({
  title,
  lede,
  children,
}: {
  title: string
  lede?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-card bg-card p-5 text-card-foreground shadow-[var(--shadow-soft)] sm:p-6">
      <header className="mb-5">
        <h2 className="font-serif text-3xl">{title}</h2>
        {lede && <p className="mt-1.5 text-sm text-muted-foreground">{lede}</p>}
      </header>
      {children}
    </section>
  )
}
