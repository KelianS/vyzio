# ADR-16: An owner account and a server session guard the interface, HTTP at home, a user-operated overlay from outside

## Context

The interface shows the cameras live, the history, the privacy switch and the camera controls. A
product that never sends an image without consent but serves it to any device on the home network
protects nothing: the home network is not a trust boundary (ACCESS-03).

The audience sets hard limits. It does not configure a reverse proxy, does not read container logs,
and reads a browser's full-page certificate warning as "this product is broken" (SPECS § Public
cible). The interface must open offline (SPECS § Objectifs produit), so nothing in its path may need
the internet to be issued or renewed.

From outside, most French providers share IPv4 addresses, so port forwarding fails for an
unpredictable share of homes. Publishing the interface on the web lets the provider decrypt the
images, against SEC-04. Running a relay is out of reach without the installed base to fund and staff
it.

## Decision

Access goes through one authentication barrier held by the API: an owner account created at first
start, a session the server holds and can revoke, plain HTTP at home on purpose, and remote access
only through an overlay network the user operates, on which the hub is a peer, never a gateway.

- **The account is born with the installation.** Until it exists, only its creation is offered and
  the API refuses everything else. It is one owner account with no username to invent.
- **Roles exist from day one.** The role is a property of the account from the first schema, with
  owner and resident (ACCESS-01): the line is use versus configure, protecting secrets and
  configuration, never images. A route declares what it requires where it is declared, never a role
  test inside a service, and the interface asks the session what it permits through one point. A
  second account comes later without reopening any route.
- **The session is server state.** The cookie carries only an opaque reference, unreadable by the
  page's scripts and sent on same-site requests only; the session lives in the database with its
  device and last use, long and sliding, revocable one by one or all at once. The cookie is never
  marked secure-only, since the transport is HTTP.
- **Everything is behind the barrier except a closed list of anonymous routes**, the code holding
  it: the health probes (ADR-01), and the routes that let someone without a session learn the
  installation's state, create the owner account while none exists, sign in and sign out. The
  images, previews and clips relayed from the video pipeline pass the same barrier. A new anonymous
  route is a change to this decision. Only signing in is rate limited.
- **Two doors, never a skeleton key.** The pairing of a messaging conversation (ADR-14) is a separate
  barrier with its own revocation: a session does not pair a conversation, a conversation does not
  open the interface, and a conversation is capped at the resident role by its command catalogue.
- **Recovery comes from the host.** A command on the machine running Vyzio removes the password,
  never sets one, closes every session, and keeps the account. The installation reopens on password
  creation for a bounded window, then locks again for everyone. Changing a known password happens in
  the interface, asks the old one, closes every session and hands the asking device a new one.
- **HTTP at home, on purpose.** No certificate, no redirect, nothing that expires. Vyzio operates no
  domain, no certificate service and no local CA. The trade-off is said in the security policy and
  once in the interface, never as a warning.
- **The remote overlay is operated by the user.** Vyzio runs no remote infrastructure: no relay, no
  control plane, no domain. The recommended overlay is NetBird, on an account the user owns; Vyzio
  guides its setup, stores the pairing key like camera credentials, and no third-party credential
  transits through Vyzio. Remote access is optional and removable without trace (ACCESS-14).
- **Vyzio starts the peer itself.** The overlay client is a container Vyzio starts and stops through
  the container runtime it already drives, so enabling it is an ordinary setting (ACCESS-16). It
  shares the network namespace of the container serving the interface and advertises no local
  subnet: only the product's entry point is reachable, the cameras, broker and engine never are
  (ACCESS-13). The host network mode is a documented fallback, never the default.
- **From outside, confidentiality is the overlay's.** Its end-to-end encrypted tunnel carries the
  same HTTP; exposing the interface on an open port stays unsupported.

## Consequences

- ✅ The interface opens offline, with no browser warning and no certificate to renew or lose.
- ✅ A lost phone is answered by revoking its session; no token survives server-side revocation.
- ✅ Vyzio runs no service for an installation: no domain, no issuance, no relay, no recurring cost.
- ✅ Even a configuration mistake on the peer cannot expose more than the product's entry point.
- ✅ The end-to-end harness opens a session like a user: no barrier exemption per environment.
- ⚠️ Anyone able to observe the home network can read the session cookie, the password and the
  preview images; browsers mark the page not secure, and features reserved to secure pages
  (installable app, web push) are unavailable, at home and through the overlay.
- ⚠️ During the recovery window, anyone who reaches the interface can take the installation.
- ⚠️ A resident can blind a camera before acting out of view; the answer, once a second account
  exists, is to attribute each cut, never to withdraw the right.
- ⚠️ Vyzio takes on the lifecycle of a container it does not own; the peer's state must read in the
  interface, or its failure passes for Vyzio's.
- ⚠️ The overlay's client must be active on the phone before opening the interface, and remote
  reachability depends on a third party the user is a customer of; the product never depends on it.

## Options rejected

| Option | Why rejected |
| --- | --- |
| No barrier, trust the home network | Any device, guest or compromised object on the Wi-Fi could watch and drive the cameras. |
| Skip sign-in by IP address | An address is not an identity, and behind a proxy it is forged by a header. |
| Authentication delegated to a reverse proxy | Makes the only protection the user's duty; a default install stays open. |
| Basic auth or a shared API key | No sign-out, no revocation, a secret copied in clear into a config file. |
| Self-contained JWT with refresh token, stored in the browser | Readable by any injected script, and not revocable without server state. |
| A fine-grained permission matrix | Where such models bog down; two roles cover what a household expresses. |
| Multiple accounts delivered at once | Only postponed: the role axis is carried now, the screens later. |
| Recovery by secret question or e-mail | Opens a back door on the network; whoever has the host already owns the data. |
| Recovery that sets a new password from the host | The password would survive in shell history and the process list, with the creation rules restated there. |
| A self-signed certificate or a local CA | A full-page warning on every device, or a technical gesture on every phone. |
| A real certificate on a domain Vyzio operates | A Vyzio cloud service in the path to the user's own home, still needing an offline fallback. |
| HTTPS on the overlay name | Encrypts twice a path the overlay already encrypts, and brings back certificate issuance. |
| A web publishing tunnel (Cloudflare Tunnel) | The provider decrypts the traffic, and its terms forbid video streaming. |
| Port forwarding with dynamic DNS | Fails behind shared IPv4 addresses, now the norm. |
| A relay operated by Vyzio | The best experience, rejected for now, not on substance: no installed base yet to fund and staff it. |
| A Tailscale overlay | Technically equal, but a closed US control plane and a free tier limited to non-commercial use. |
| The peer added by hand to the deployment file | Turns an ordinary setting into an installer's task. |
