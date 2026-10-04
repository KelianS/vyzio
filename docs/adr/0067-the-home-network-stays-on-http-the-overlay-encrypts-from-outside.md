# ADR-67: The home network stays on HTTP, the overlay encrypts from outside

> Status: Accepted
>
> Amends [ADR-51](0051-remote-access-to-the-interface-netbird-overlay-network-operated-by-the-user.md)
> on its first consequence: an encrypted entry point is no longer a prerequisite to remote access,
> the overlay's tunnel carries that confidentiality.

## Context

The interface is served over plain HTTP: on the home network, the session cookie, the password and
every preview image travel in the clear (#67). ADR-51 made an encrypted entry point a prerequisite to
announcing remote access.

Two constraints rule out the usual answers. The interface must open offline (SPECS 1.4), so a
certificate that can only be obtained or renewed over the internet breaks the local-first promise.
And no browser may put a full-page warning in front of a user who did nothing wrong: to a
non-technical household it reads as "this product is broken" (SPECS 1.2, principle 1).

## Options compared

| Option | Description | For | Against |
|---|---|---|---|
| **A. Self-signed certificate, or a local CA** | The hub signs its own certificate | Offline, free | A full-page warning on every device, unless each one installs the CA: a technical gesture on every phone in the house |
| **B. A real certificate on a domain Vyzio operates** | A per-installation name resolving to a private address, issued over a DNS challenge | Trusted by every browser, no warning | Vyzio operates a DNS zone and an issuance service: a cloud dependency at setup and at each renewal, a name lookup to open the interface, and an offline installation still needs a fallback |
| **C. HTTPS on the overlay name only** | A certificate for the hub's stable overlay name | Encrypts the remote path at the application layer | Same issuance problem as A or B, for a path the overlay already encrypts end to end |
| **D. HTTP at home, the overlay encrypts from outside, said plainly** | The home network stays in the clear; remote access goes only through the overlay of ADR-51 | Offline, no warning, no service to operate, nothing to expire | Anyone able to observe the home network can read the traffic |

**Option D chosen.**

## Decision

**a) The home network is served over HTTP, deliberately.** No certificate, no redirect, nothing that
can expire: the interface answers the same way online and offline. Its confidentiality on the home
network is that network's: its Wi-Fi encryption and who is on it.

**b) From outside, confidentiality is the overlay's.** Remote access goes only through the overlay of
ADR-51, whose WireGuard tunnel encrypts end to end between the phone and the hub. The interface
travels inside it over the same HTTP, and nothing in clear text crosses a network the user does not
own. Exposing the interface on an open port stays unsupported.

**c) Vyzio operates no domain, no certificate service and no local CA.** Any of them would be a
service Vyzio runs for every installation, where ADR-51 leaves remote access operated by the user.

**d) The trade-off is said, not hidden.** The security policy states it. The interface says it once,
in the help line of the remote-access setting (#62), and nowhere else as a warning.

## Options rejected

**Self-signed certificate or local CA (A).** It trades a silent weakness for a visible failure: the
warning lands on the first screen of every device, and removing it asks each member of the household
for a gesture Vyzio promises never to ask.

**A domain operated by Vyzio (B).** The interface would depend on a Vyzio service to be issued, renewed
and resolved: a cloud dependency in the path to the user's own home, and still a fallback to design
for an offline installation.

**HTTPS on the overlay name (C).** It encrypts twice a path WireGuard already encrypts, and brings back
the issuance problem of A or B to do so.

## Consequences

- ✅ The interface opens offline, with no browser warning and no certificate to renew or to lose
- ✅ Vyzio runs no service for an installation: no domain, no issuance, no recurring cost
- ✅ Remote access no longer waits on the transport: #62 can be delivered on the overlay as it is
- ⚠️ Anyone able to observe the home network, a shared or compromised Wi-Fi for instance, can read the
  session cookie, the password and the preview images
- ⚠️ Browsers mark the page as not secure in their address bar, a discreet mention rather than a
  warning page
- ⚠️ A browser feature reserved to secure pages is out of reach on the home network address
