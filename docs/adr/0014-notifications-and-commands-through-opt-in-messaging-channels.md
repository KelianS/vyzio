# ADR-14: Notifications leave through opt-in messaging channels that carry the image, and the same channels take commands back

## Context

The key need is to see the detection's image in the notification, away from home (NOTIF-03), and to
act from there without a network access to the product, which stays optional (NOTIF-26, NOTIF-27,
ADR-16). The hub has no public address and never gets one: nothing outside can call it, nor fetch an
image from it. Sending an image to a third-party service leaves the home network, so it is explicit
and opt-in (SEC-01, NOTIF-04).

Several channels coexist, set up with one screen (NOTIF-02, NOTIF-05), and a command behaves the same
on all of them (NOTIF-08). Channels differ in what they render (buttons, image, video, useful text
length), and in whether the surface that sends is the one that receives: a write-only address can
send but never receive.

## Decision

A notification leaves only through a messaging channel the owner has set up and enabled, which
carries the image itself; each channel is an adapter behind one port in both directions, and a
command is declared once, whatever channel carries it.

- Each enabled channel opens one outbound flow to its third-party service, carrying the detection's
  image or clip. None is on by default: enabling it is the owner's explicit consent. Biometric data
  never travel (ADR-13).
- The sender applies the person's policy (ADR-13), then the channel's filters, then the muting rules
  (ADR-15). The media is a read that retries until it is ready, never a fixed wait.
- A channel declares what it renders and, per direction, a transport and the credentials it needs. A
  channel with no inbound transport is a notification channel and nothing more.
- Inbound runs only by outbound retrieval, a long poll or a gateway connection, never by a webhook;
  a service that offers only a webhook stays outbound only. One retrieval loop runs per channel set
  up to receive, started and stopped with its configuration.
- The channel's native bot carries both directions under one identity. The commands are published in
  the channel's own grammar, so the bot reads only what is addressed to it, never the conversation.
- A command declares its name, typed parameters, authorisation and a structured result: a text, an
  optional media, the follow-ups. The channel renders it as it can, and the command runs through the
  same use cases as the HTTP API.
- The inbound direction is an authentication boundary: only a conversation paired from the
  interface is accepted, anything else is ignored without an answer. Pairing is revocable, and a
  door apart from the interface session, capped at the resident role (ADR-16).
- A conversation consults and acts, never configures: no setting, no secret, no continuous video.
  A consequential action waits for a confirmation in the thread.
- Channel secrets are kept apart: once stored, never handed back, only whether they are set. The
  channel's status, the notification log (ADR-12) and the command journal are records of their own.

## Consequences

- ✅ The image reaches the user anywhere, with no tunnel, certificate or exposure of the hub.
- ✅ The commonest remote gestures need no network access to the product.
- ✅ A command is written once for every channel; a new channel is an adapter, not a screen.
- ✅ Commands and the interface cannot drift apart: one business path behind both.
- ✅ The command journal is the trace to read should a pairing leak.
- ⚠️ The image passes through the channel's servers: a trade-off the interface states before the
  channel is enabled.
- ⚠️ Notifications and commands depend on internet and on the third party (SYS-03): they extend
  local use, never replace it, and a channel back from an outage replays nothing (NOTIF-11).
- ⚠️ A bot costs a longer setup than a write-only address; the channel's setup guide in the
  interface must carry it entirely (ADR-17).
- ⚠️ A failed retrieval loop leaves a paired conversation silent; the channel's settings must say so
  (NOTIF-25).
- ⚠️ Channel secrets are stored in the local database without encryption at rest: their protection is
  the hub's.

## Options rejected

| Option | Why rejected |
| --- | --- |
| Native push, or a generic webhook, with an image link signed by the hub | The phone would fetch the image from the hub, which needs a public address or a tunnel the hub never has; never built |
| One privileged channel, the others secondary | Splits behaviour by channel; every channel is one adapter among others |
| A business messaging API that is paid, reserved to companies and receives by webhook only | Complex and costly setup for a non-technical user, and outbound only |
| Unofficial client libraries simulating a messaging app | Against the service's terms, with a risk of the account being banned: no base for a product |
| A messenger with no official bot API | Nothing to build on |
| Commands written inside each channel adapter | Every command paid once per channel, and behaviours drift apart |
| An outside automation calling Vyzio's API | The user hosts and configures a second system (principle 5), and a long-lived API token sits at a third party |
| Rely on network access to the interface alone | A VPN becomes mandatory for the commonest gesture |
| Receive by webhook | Needs the public address the hub never has |
| A write-only address to send, a bot to receive | Two setups for one channel, two identities in the same room, and "configured" no longer means anything |
| Commands on one channel only | Restores a privileged channel |
| A bot that reads every message of the room | Access to the whole conversation, when Vyzio needs only what is addressed to it |
| Configure from a conversation | A thread carries no draft, no provenance, no undo (ADR-15): changes would be invisible and irreversible |
| Notification hours on each channel's settings | Replaced by the muting rules of the schedule (ADR-15) |
| Channel settings read once at start-up | Settings made in the interface would be ignored until a restart (NOTIF-06) |
