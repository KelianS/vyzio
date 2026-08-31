# TAD: camera network discovery

> How the discovery subsystem works. The *why* behind the choices is in
> [ADR-32](../adr/0032-three-stage-network-discovery-pipeline-identification-enrichment-interpretation.md) (three-stage pipeline) and
> [ADR-31](../adr/0031-manual-vendor-override-at-onboarding.md) (manual override).
> Home of the code: `src/vyzio/Vyzio.Infrastructure/Services/CameraDiscovery/`.

## Role

Starting from a **network scope** (hosts or CIDR ranges), produce the list of devices present, enriched
with verifiable facts (open ports plus confirmed protocol, hostname, MAC) and with an interpretation
(probable brand, supported capabilities), **without ever hiding** an unrecognised device.

## The three stages

The pipeline is orchestrated by `AssistedCameraDiscoveryProbePipeline`. Each class carries a header
comment stating which stage it belongs to.

| Stage | Responsibility | Class(es) |
|---|---|---|
| 1. Identification | Which hosts exist (ping or explicit target) | `AssistedCameraDiscoveryProbePipeline` (`IdentifyHostsAsync`, `PingSweepAsync`) |
| 2. Enrichment | Verifiable facts per host (ports and fingerprint, RTSP, ONVIF, hostname, MAC) | `AssistedCameraDiscoveryProbePipeline` (`Discover*SignalsAsync`) |
| 3. Interpretation | Brand and capabilities, from structured evidence | `AssistedCameraDiscoveryIdentifier`, `AssistedCameraDiscoveryFormatter`, `AssistedCameraDiscoveryService` |

**Golden rule**: a stage never does another stage's work. Identification does not filter what gets
displayed (every identified host receives a baseline `network_host` signal, priority `-10`); enrichment
suggests no brand (raw facts only); interpretation derives the brand only from a structured
`discoverySource`, never from the text of the notes.

## Signal model and qualification

- **`RawCameraDiscoverySignal`**: one fact produced by enrichment (source, port, note,
  `ConfirmedProtocol?`, `PortServiceLabel?`).
- **`DiscoveryProtocolCatalog`**: maps each `discoverySource` to a merge priority (plus the
  `SupportedProtocol` for the sources that prove a protocol). Used by the `Formatter` to pick the
  winning signal when several describe the same host.
- **`AssistedCameraDiscoveryIdentifier`**: qualifies each host on three tiers
  (`DetermineQualification`). **`camera_confirmed`** (a camera port or protocol confirmed: ONVIF, KLAP,
  or RTSP with a known path), **`camera_likely`** (a strong but unconfirmed hint: RTSP answering
  without a known path, an HTTP camera signature, a MAC OUI or a suggestive hostname),
  **`device_unknown`** (no qualifying signal, including the baseline `network_host` signal). This
  matches the product need in SPECS §2.2 ("distinguish a confirmed camera, a probable camera and an
  unqualified device").
- **`AssistedCameraDiscoveryFormatter`**: merges the signals per host (by priority) and decides what is
  exposed to the frontend.

## Port scanning and fingerprinting ("nmap")

Single source of truth: **`DiscoveryPortCatalog`** (do not duplicate its table here, it lives in the
code).

- `ScannedPorts`: every TCP-connected port, with its conventional label (HTTP, SSH and so on). **Every
  open port is displayed**, even without a recognised protocol ("unidentified").
- `Fingerprints`: protocol to candidate ports plus label. An open port is **labelled** with a protocol
  only once its credential-free handshake passes (`ConfirmProtocolAsync`): RTSP `OPTIONS`, ONVIF SOAP
  `GetSystemDateAndTime`, DVRIP byte `0xFF`, the V380 256-byte auth frame, Tapo KLAP `handshake1`. One
  port can confirm several protocols (many-to-many).

Other enrichment sources, kept for their own value: RTSP DESCRIBE (stream path), ONVIF multicast
announcement (hostname), rDNS (hostname), ARP and OUI (vendor hint).

## Capabilities derived from the registry

Interpretation hardcodes no capability: `AssistedCameraDiscoveryService.GetDetectedCapabilities`
crosses the protocols detected on the host with
`ICapabilityProviderRegistry.GetRegisteredProtocols(capability)`, the **same** registry that drives
detection when a camera is added ([ADR-22](../adr/0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md),
[ADR-28](../adr/0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md)). `Stream` is a
first-class capability (`IStreamCapabilityProvider`), not a special case.

## Output contract (towards the frontend)

The backend carries **already localised** DTOs; the frontend is pure display (no protocol or capability
name hardcoded):

- `DetectedPortSignal(Protocol, Label, Port)` feeds the `Port | Protocol` table.
- `DetectedCapability(Capability, Label, ProtocolLabels)` feeds the `capability to protocols` list.

## Configuration

**Network scope only** (`DiscoverySettings`: `ProbeHosts`, `ProbeCidrs`, `AutoDetectLocalCidrs`,
`ProbeTimeoutMs`, `MaxConcurrentProbes`). Ports, RTSP paths and protocols are **internal constants** of
`DiscoveryPortCatalog`, never exposed to the user. The `*Override` fields of `DiscoverySettings` are
**for tests only**, never read from the configuration or the environment (test hermeticity).

## Known limits

- ICMP ping and ARP reads require network privilege (on Linux, `CAP_NET_RAW` and the `host` network). A
  safety net (falling back to the unfiltered list when no ping answers) absorbs blocked ICMP without
  resolving it.
- V380 fingerprinting is *best effort* (no documented response signature): it prefers "unidentified"
  over a false "V380".
- A curated port set, not 1-65535 (the cost being TCP-connect times hosts).

## Adding a protocol with a dedicated port

One `ScannedPorts` entry and one `Fingerprints` entry in `DiscoveryPortCatalog` (plus a case in
`ConfirmProtocolAsync` reusing an existing probe). Detection, port display, camera confirmation and
capability crossing follow automatically, frontend included.
