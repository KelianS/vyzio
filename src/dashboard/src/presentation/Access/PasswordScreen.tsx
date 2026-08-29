import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../common/ui/button'
import { Input } from '../../common/ui/input'

/**
 * Le seul ecran qu'on voit sans etre entre. Il porte son aide sur place : il n'y a aucun ecran
 * derriere lequel la replier, ce qu'ADR-53 prevoit explicitement.
 */
export function PasswordScreen({
  title,
  lede,
  label,
  hint,
  action,
  error,
  busy,
  minLength,
  help,
  onSubmit,
}: {
  title: string
  lede: string
  label: string
  hint?: string
  action: string
  error?: string
  busy?: boolean
  minLength?: number
  help?: ReactNode
  onSubmit: (password: string) => void
}) {
  const [password, setPassword] = useState('')
  const tooShort = minLength !== undefined && password.length > 0 && password.length < minLength

  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || password.length === 0 || tooShort) return
    onSubmit(password)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2">
        <p className="font-serif text-xl tracking-tight text-muted-foreground">Vyzio</p>
        <h1 className="font-serif text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{lede}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium">
            {label}
          </label>
          <Input
            id="password"
            type="password"
            autoFocus
            autoComplete={minLength === undefined ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error !== undefined || tooShort}
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-sm text-muted-foreground">
            {tooShort ? `Au moins ${minLength} caractères.` : hint}
          </p>
        </div>

        {/* Un refus se lit a cote du champ refuse, jamais dans une notification qui s'efface. */}
        {error !== undefined && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={busy || password.length === 0 || tooShort}
          className="w-full"
        >
          {busy ? 'Un instant…' : action}
        </Button>
      </form>

      {help}
    </main>
  )
}
