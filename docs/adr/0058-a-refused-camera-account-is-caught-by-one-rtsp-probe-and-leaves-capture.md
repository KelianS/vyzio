# ADR-58: A refused camera account is caught by one RTSP probe, and the camera leaves capture

> Status: Accepted
>
> Amends [ADR-44](0044-surveillance-restart-an-explicit-user-act-grouped-and-deferred.md) on one case:
> Vyzio reloads the capture on its own to take out a camera whose account is refused (c).

## Context

A camera's account can stop being accepted after the camera was added: the password changed in the
vendor app, a firmware update wiped the third-party account (a known Tapo behaviour), or a Vyzio defect.
The capture then retries on its own, without end. On a Tapo C200 this meant 48 refused authentications
in three minutes, after which the camera refused even the right password from Vyzio's address for
about half an hour. The user saw a dark camera, not a refused password (SPECS 2.2, principle 4), and the
ban hid the camera from every other protocol Vyzio drives it by.

Two signals could tell a refusal apart from an outage: the capture's own logs, or a check of Vyzio's own.
The logs cost no extra attempt, but tie Vyzio to the log format of its capture engine, which is meant to
stay replaceable (principle 2).

## Decision

**a) Vyzio asks the camera itself, with one RTSP `DESCRIBE`.** The probe sends the request without
credentials; a camera that answers `401` gets the same request once more with the camera's own account,
in the scheme it named (Digest or Basic). It reads `Accepted`, `Refused` or `NoAnswer`. It never guesses
an account and never sends one to a camera that did not ask. It is built to also serve the credential
check when a camera is added.

**b) A camera is probed once per outage.** A watcher reads the capture's frame rates on a fixed period.
A validated, enabled camera outside privacy mode that shows no frames on two readings in a row is probed
once; it is not probed again until it streams again or its credentials change. An outage that is not a
refusal (`NoAnswer`, `Accepted`) changes nothing.

**c) A refused account takes the camera out of capture.** Vyzio records when the account was refused on
the camera and reloads the capture without it, which stops the retries before the camera bans Vyzio.
This reload is Vyzio's own initiative, the one exception SPECS 7.2 names to surveillance being
interrupted only by the user. The camera says so on its card and on the home screen, as a cause
distinct from being offline, with where to fix the password; the interface treats it as unreachable, so
no other action (moving it, its image settings, a capability test) spends an attempt on it.

**d) The refusal ends when the camera lets Vyzio in again.** Saving new credentials clears it, and the
connection check that follows puts the camera back into capture, as for any change of how Vyzio
reaches it. A connection check alone asks the probe once more and, if the camera now accepts (a
password restored in the vendor app), clears the refusal and writes the camera back into the capture
config, taken up at the restart the user triggers (ADR-44). If the account is still refused, (b) and
(c) catch it again after a handful of attempts, never a loop.

**e) The refusal sits beside reachability, not inside it.** ADR-23's online and offline status says
whether the camera answers on the network; the watcher acts only once capture has gone dark, whatever
that status says, and its verdict comes from the camera, never from the capture engine.

## Options rejected

- **Read the refusal in the capture engine's logs.** No extra attempt, but it couples Vyzio to the log
  format of an engine that must stay an implementation detail (principle 2).
- **Probe every camera on a schedule.** Each probe is an authentication attempt; on a camera already
  refusing the account, a schedule would feed the very lockout this decision prevents.
- **Probe with an unauthenticated `OPTIONS`.** Many cameras answer it without asking for an account, so
  it cannot tell a refused password from an accepted one.

## Consequences

- A camera whose account is refused does not record until the user fixes the password, and is left
  alone meanwhile.
- A DVRIP camera speaks no RTSP on its port, so its refused account is not caught this way.
- The probe runs only after two silent readings, so a refusal is caught within about a minute of the
  capture going dark, a few attempts in.
- The reload is attempted once. If it fails, the refusal stays recorded and the capture config written
  without the camera is marked pending, so the user is offered the restart (ADR-44); until then the
  capture keeps retrying it, and the failure is logged. Retrying the reload on its own would restart
  surveillance again and again, beyond the one exception SPECS 7.2 allows.
- A camera that bans after very few attempts can still lock Vyzio out before the watcher acts; the card
  then says the account is refused, which remains true once the lockout ends.
