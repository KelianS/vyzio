import type { ReactNode } from 'react'
import type { NotificationChannelName } from '../../domain/entities/NotificationChannelConfig'
import { CHANNEL_SETUP } from './channelSetup'

/** `code` and [label](url), the only two marks a setup step needs. */
const MARKS = /(`[^`]+`|\[[^\]]+\]\([^)]+\))/g

export function ChannelSetupSteps({ channel }: { channel: NotificationChannelName }) {
  return (
    <ol className="list-decimal space-y-3 pl-5 text-sm">
      {CHANNEL_SETUP[channel].steps.map((step) => (
        <li key={step.title}>
          <span className="font-medium">{step.title}</span>
          <p className="text-muted-foreground">{render(step.body)}</p>
        </li>
      ))}
    </ol>
  )
}

function render(body: string): ReactNode[] {
  return body.split(MARKS).map((fragment, index) => {
    const key = `${index}-${fragment}`

    if (fragment.startsWith('`')) {
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-xs">
          {fragment.slice(1, -1)}
        </code>
      )
    }

    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(fragment)
    if (link) {
      return (
        <a
          key={key}
          href={link[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          {link[1]}
        </a>
      )
    }

    return <span key={key}>{fragment}</span>
  })
}
