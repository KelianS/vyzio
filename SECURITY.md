# Security policy

Vyzio watches a home and keeps the footage there. A weakness in it is not an inconvenience, it is
the failure of the one promise the product makes. This document says what is supported, how to
report a flaw, and what Vyzio does and does not defend against today.

## Supported versions

Vyzio is pre-1.0 and moves fast. Only the latest release receives fixes, and there is no backport
to an earlier tag.

| Version | Supported |
| ------- | --------- |
| Latest release | Yes |
| Anything older | No, update first |

Updating is `docker compose pull && docker compose up -d`, and the data survives it.

## Reporting a vulnerability

**Report privately, through
[GitHub Security Advisories](https://github.com/KelianS/vyzio/security/advisories/new).** That
channel is private between you and the maintainer until a fix ships. Please do not open a public
issue for a vulnerability, and do not disclose it elsewhere before a fix is available.

Useful in a report: the version, how Vyzio is deployed, the steps that reproduce the problem, and
what an attacker gains from it. A proof of concept helps more than a description.

This is a single-maintainer project with no support commitment, so expect an acknowledgement within
a week rather than within a day. You will be credited in the advisory unless you ask otherwise.

## What Vyzio assumes

**Vyzio is built for a home network you trust, on a machine you own.** The whole system sits behind
one entry point and one authentication boundary: the dashboard container is the only service
published, the API is reachable only from the Docker network, and Frigate is bound to `127.0.0.1`
and never routable from outside. Nothing is reachable before an owner password has been set.

**Vyzio also assumes the machine is yours to give.** Its API container carries the host's Docker
socket, because writing a configuration is only half of applying it: something has to restart Frigate.
A container holding that socket can do anything on the host, and mounting it read-only changes nothing
there, since the restriction applies to the file and not to the commands sent through it. Whoever
executes code inside `vyzio-api` therefore holds the machine.

That is a deliberate trade for a product meant to install itself without asking anyone to write YAML,
and it is bounded on the side that matters: the container is not published, and the command it runs is
read from the environment when the process starts, never from a request. No route can choose it.

The threat model, surface by surface, lives in [`docs/SAD.md`](docs/SAD.md) section 9.1 and is not
repeated here.

### A known gap, stated plainly

**The entry point is served in the clear over HTTP.** There is no TLS, no certificate and no
redirect. On the local network, the session cookie, the password and every preview image travel
unencrypted, and anyone able to observe that network can read them.

This is deliberate sequencing rather than an oversight: it is recorded as the single target-versus-
reality gap of the architecture document, and it is tracked in
[issue #67](https://github.com/KelianS/vyzio/issues/67). Until it closes, treat an installation as
only as private as the network it sits on.

## Out of scope

- **Exposing the interface directly to the internet.** Port-forwarding the dashboard is not a
  supported deployment, and reports based on it will be closed. Remote access is delivered through
  a user-operated overlay network instead, where the hub is a peer and not a gateway
  ([ADR-51](docs/adr/0051-remote-access-to-the-interface-netbird-overlay-network-operated-by-the-user.md)).
- **An attacker who already has the machine.** Vyzio does not defend against someone with a shell
  on, or physical access to, the host: they hold the database and the disk.
- **The reset window, while it is open.** Clearing a forgotten password deliberately reopens the
  installation for 30 minutes to anyone on the local network. That is a bounded, documented
  trade-off, not a flaw. The README says so where the command is given.
- **Vulnerabilities in Frigate itself.** Report those to
  [the Frigate project](https://github.com/blakeblackshear/frigate/security). Report to us how
  Vyzio exposes one.

## What runs on every change

The [Security workflow](.github/workflows/security.yml) runs on every push and pull request, and
weekly: Semgrep static analysis, and a dependency audit on both the .NET and the frontend package
trees. CodeQL on C# and TypeScript is configured in the same workflow and runs as soon as the
repository is public, which is what its free tier requires.
