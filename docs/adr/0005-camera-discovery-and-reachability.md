# ADR-05: Vyzio finds cameras by a unicast sweep in three stages, and watches their reachability itself

## Context

The owner adds cameras without knowing their network configuration (principle 5, UC-CAM-01), and
the status of a camera must stay current and read without a technical diagnosis (CAM-07, CAM-08).

- The stack runs on a Compose bridge network, and host networking is not taken: it would put the
  API, and the dashboard with it, on the host's network. From the bridge, neighbour tables and
  multicast see nothing of the home network.
- A discovery that mixes finding hosts, collecting facts and naming a vendor gives false positives
  (a vendor deduced from a protocol several makers share) and blind spots (a device with no
  recognised protocol vanishing from the list). A device should never be hidden (CAM-33).
- An open port is not a protocol: the same port number serves different protocols from one maker to
  the next, and a standard protocol may answer on any port.
- Sweeping every protocol against every address of a range is costly; most addresses are empty.
- The video engine knows only the cameras already in surveillance, and its view of a camera follows
  its own state, not the network's. A camera's status left to an explicit check went stale for
  hours.
- Several cameras of the same maker can share a home; an answer to a broadcast may come from the
  wrong one.

## Decision

Discovery is Vyzio's own, a unicast sweep in three ordered stages that names a vendor only on
proof, and reachability is a periodic connection Vyzio makes itself, never inferred from Frigate.

- **Behind Vyzio's own adapter**, independent of any discovery the video engine may offer; typing
  an address is always a complete path. Discovery hands the new camera its address only (ADR-04).
- **Its perimeter is the network only**: the configured ranges, the subnet of the private address
  the dashboard was opened by (CAM-29), and explicit hosts. Ports, paths and fingerprints are
  internal, held in one catalogue; adding a protocol with its own port is one entry there.
- **Unicast only.** No neighbour table, no hardware address, no multicast. The V380 device number
  is asked of the camera's own address only, never by broadcast; typing it stays the last resort
  (its derivation: ADR-06).
- **Stage 1, identification**: which hosts exist. Explicit hosts are never filtered. Swept hosts are
  filtered by an ICMP echo; when none answers, the sweep keeps every address, since a blocked echo
  is likelier than an empty network. Every identified host carries a base signal that ranks below
  any other, so it stays visible.
- **Stage 2, enrichment**: verifiable facts, never a vendor. Every open port of the catalogue is a
  fact, shown even when no protocol is recognised on it. A port carries a protocol only once a
  handshake that needs no account confirms it, the same question the camera's own client asks
  (ADR-04); one port may confirm several protocols. The stream path a camera describes and its
  reverse DNS name are collected; no fingerprint is kept for a protocol the cameras do not speak.
- **Stage 3, interpretation**: from structured evidence only, never from note text. A qualification
  (confirmed, likely, unknown) with the reasons behind it (CAM-30, CAM-32); the capabilities
  discovery saw, the detected protocols crossed with the same provider registry detection uses
  (ADR-04), the stream included; the vendor only from an answer its proprietary protocol alone gives
  without an account. The API sends the labels; the dashboard hardcodes no protocol name.
- **Reachability**: a background service in the API connects, at a steady interval, to the port of
  the protocol of the stream that records, for every camera in surveillance; a camera with no stream
  bound has nothing to watch and needs attention. The status is written only when it changes. It is
  Vyzio's own projection of the camera, never read from Frigate's events.
- **Deployment constraint**: the ICMP echo needs the raw socket privilege, which the API container
  holds on the default bridge. A deployment that drops it loses the filter without an error, and
  the fallback above sweeps every address instead, slower but complete.

## Consequences

- ✅ No device disappears: a host with no recognised protocol stays visible, its open ports listed
- ✅ No vendor false positive: a shared protocol, a port, a name or a page never names one
- ✅ A sweep probes the live hosts, not every address of the range
- ✅ Discovery works the same from the bridge as anywhere: it relies on no signal the topology hides
- ✅ A camera's status is maintained for every camera in surveillance, whatever Frigate's state
- ⚠️ A camera outside the swept ranges is added by typing its address
- ⚠️ The set of ports is curated, not exhaustive; a camera on another port is found by its address
- ⚠️ A proprietary handshake with no documented answer is confirmed best-effort, preferring
  "unidentified" to a wrong protocol
- ⚠️ The echo before the probes adds latency to a sweep
- ⚠️ A status lags reality by up to one interval
- ⚠️ A sleeping battery camera reads as offline: reachability cannot tell sleep from loss
- ⚠️ Discovery and detection both look at the camera; discovery could later shrink to finding
  addresses

## Options rejected

| Option | Why rejected |
| --- | --- |
| Labelling a port by its number alone | A port is not a protocol: false positives, and a standard protocol invisible off its usual port |
| Hardware address prefixes and multicast discovery | See nothing from the bridge, and a prefix often names the network module's maker |
| Host networking for discovery | Puts the API and the dashboard on the host's network; a wider unicast sweep finds the same cameras |
| A vendor from an open port, a hardware address prefix, a host name or a page | Each points at a module maker or a shared protocol: the sheet would be wrong as often as right |
| Finding the V380 device number by broadcast | Fragile from the bridge, and may return another camera's number |
| Separate probes per protocol beside the port sweep | Redundant with the sweep and its handshakes |
| Ports and paths as user settings | The owner does not know which protocol a camera speaks |
| Depending on a discovery service of the video engine | Couples adding a camera to an interface that may change; no manual fallback |
| A status polled by the dashboard on demand | One full probe per camera on screen, again and again |
| A status deduced from the video engine's events | Ties network reachability to the engine's state; cameras not in surveillance would be invisible |
