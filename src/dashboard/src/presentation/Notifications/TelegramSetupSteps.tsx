import type { ReactNode } from 'react'

/** Mise en route du bot : quatre gestes qui ont lieu **dans Telegram**, pas ici. */
export function TelegramSetupSteps() {
  return (
    <ol className="list-decimal space-y-3 pl-5 text-sm">
      <li>
        <Step title="Créez un bot">
          Écrivez à <TelegramLink handle="BotFather" /> et envoyez <Code>/newbot</Code>. Il répond
          avec une clé de la forme <Code>123456:ABC…</Code> à recopier ci-dessus.
        </Step>
      </li>
      <li>
        <Step title="Démarrez-le">
          Ouvrez la conversation avec votre nouveau bot et envoyez-lui <Code>/start</Code>. Sans ce
          premier message, Telegram lui interdit de vous écrire.
        </Step>
      </li>
      <li>
        <Step title="Relevez l’identifiant de conversation">
          Écrivez à <TelegramLink handle="userinfobot" /> : il répond aussitôt avec votre numéro.
        </Step>
      </li>
      <li>
        <Step title="Vérifiez">
          Enregistrez, puis envoyez un message de test : il doit arriver sur Telegram.
        </Step>
      </li>
    </ol>
  )
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <span className="font-medium">{title}</span>
      <p className="text-muted-foreground">{children}</p>
    </>
  )
}

function TelegramLink({ handle }: { handle: string }) {
  return (
    <a
      href={`https://t.me/${handle}`}
      target="_blank"
      rel="noreferrer noopener"
      className="underline underline-offset-2"
    >
      @{handle}
    </a>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>
}
