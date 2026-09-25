# TAD: the ONVIF client and endpoint resolution

> How Vyzio talks ONVIF. The *why* behind the choices is in
> [ADR-56](../adr/0056-the-onvif-endpoint-is-asked-of-the-camera-not-assumed-by-convention.md)
> (endpoint asked of the camera), [ADR-22](../adr/0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md)
> (resolution by protocol, never by brand) and
> [ADR-28](../adr/0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md) (capability cascade).
> Home of the code: `src/vyzio/Vyzio.Infrastructure/VendorAdapters/OnvifClient.cs`,
> `OnvifEndpointResolver.cs`, and the providers in `Vyzio.Infrastructure/CapabilityProviders/`.

## Role

Speak ONVIF to any compliant camera, whatever port and path that camera happens to serve it on, and
whatever brand is on the box. Feature logic (PTZ steps, imaging, presets) lives in the providers; this
document covers the transport and how its address is found.

## Layers

| Layer | Responsibility | Class |
|---|---|---|
| Address | Where this camera's ONVIF services live | `OnvifEndpointResolver` |
| Transport | SOAP envelope, WS-UsernameToken digest, send, read fault | `OnvifClient` |
| Features | PTZ, imaging, media profiles, device identity | `OnvifPtzProvider`, `OnvifImageSettingsProvider`, `CameraStreamEnumerator`, `V380DeviceIdBootstrap` |

A provider never builds a URL and never sees a port. It calls `OnvifClient` with a camera and a
service name; the address is resolved beneath it.

## Endpoint resolution

The unit of resolution is the **device service URL**. Everything else is read from the camera's own
answer.

1. **Stored.** `Camera.ProtocolEndpointsJson`, keyed by `SupportedProtocol`, taken as-is: only a real
   resolution writes it, and a stale one surfaces as a failed call. No sweep.
2. **Swept**, when nothing is stored. The ONVIF ports of `DiscoveryPortCatalog` crossed with the
   candidate paths below. First answer wins, and becomes the device service URL.
3. **Announced.** Whether stored or swept, the device service is then asked `GetServices`, which gives
   an `XAddr` per service namespace. Authoritative, and the only correct source for the per-service
   paths. It is asked without credentials first, `GetServices` being pre-authentication in the ONVIF
   core; the camera's own account is presented only if it answers 401, and nothing is ever guessed. A
   camera behind NAT announces its own idea of its address: the announced path is kept, on the host
   Vyzio reached. Only a real answer is kept in memory; a lost one is asked again on the next call.

Candidate paths, in order: `/onvif/device_service` (the common convention), `/onvif/service` (one
endpoint for every service, Tapo), `/device_service`.

**Single-endpoint firmwares**: when `GetServices` reports no `XAddr` for a service, that service is
addressed at the device service URL. This is not a special case for a brand, it is the fallback that
makes a one-endpoint camera work without naming it.

**The identification probe is `GetSystemDateAndTime`**, which the ONVIF core specification defines as
requiring no authentication. A sweep must never present credentials: a wrong guess repeated across
ports locks accounts out on some firmwares (a Tapo cools down for about 25 minutes after 10 failures).
An answer that demands authentication (401 with an ONVIF realm) still identifies the service.

`OnvifServiceProbe` holds that envelope and the test that recognises an ONVIF answer, and the
discovery fingerprint uses both, so a camera recognised at discovery is a camera reachable afterwards.
The two transports stay separate on purpose: discovery opens a raw socket because it sweeps a whole
subnet and must survive a non-HTTP answer, the resolver uses `HttpClient` against one known camera.
What is shared is the question and how its answer is read, not the plumbing.

Resolution is cached in memory per camera and persisted by the use-case layer at probe time, the way
the V380 device id already is. Nothing in `OnvifClient` writes to the database. A camera where no port
answered is cached as such for five minutes, so a DVRIP-only or V380-only camera does not re-sweep on
every call; a caller that gives up mid-sweep leaves no such mark.

## Forgetting a resolved address

A camera changes: a service gets enabled in the vendor app, a firmware moves a port. A remembered
address that is never dropped would make that change invisible, and deleting the camera would be the
only way out.

Both halves are dropped together, `Camera.ProtocolEndpointsJson` and the process-wide cache behind
`ICameraProtocolEndpointCache`; clearing one alone leaves the other in charge. Two user gestures do
it, and both are the user saying "look at this camera again":

| Gesture | Endpoint | What runs |
|---|---|---|
| Test one capability (`POST /capabilities/{capability}/probe`) | per capability | `ProbeCameraCapabilityUseCase`, `rediscoverEndpoints: true` |
| Detect capabilities (`POST /capabilities/detect`) | whole camera | `SeedAndProbePresetsUseCase`, once before the cascade |

The cascade forgets **once** for a whole run, never per candidate protocol: re-resolving between
candidates would re-sweep the ports several times for one gesture.

A network scan (`POST /discovery`) does not go through this: it works on hosts, not on configured
cameras, and holds no per-camera state of its own.

## Queries and commands

Two send paths, and the difference matters.

- **Queries** (`GetProfiles`, `GetStatus`, `GetPresets`, `GetImagingSettings`) read the response.
  `throwOnFailure: true` raises instead of returning nothing, so a probe can say *why*, instead of
  reporting an unsupported capability.
- **Commands** (moves, presets, `SetImagingSettings`) wait 1.5 s for an answer, 300 ms for the start of
  a continuous move, which a step stops shortly after. **Silence is treated as success**: budget cameras execute on TCP receipt and answer seconds later, and PTZ steps cannot wait
  for them. Anything else that goes wrong is raised, and classified below.

A failure is one of two things, both in `Vyzio.Core/Interfaces/CameraCommandException.cs`:

| The camera… | Examples | Raised as | API code |
|---|---|---|---|
| answered, and said no | an error status, a SOAP fault, a malformed answer, an unreadable body | `CameraCommandRefusedException` | `camera_refused` |
| could not be reached | connection refused, no route, no ONVIF service found | `CameraUnreachableException` | `camera_unreachable` |

A malformed answer is `HttpRequestError.InvalidResponse` or `ResponseEnded`: the camera spoke, badly.
Every other transport error means it did not. The message of either is support detail: the service,
the status, the SOAP fault or the transport error, never a credential. `CameraCommandExceptionHandler`
turns both into a 502 whose body carries the code and that message; the interface branches on the code,
never on the status, which a proxy in front of the API also sends.

## Known camera behaviours

| Behaviour | Effect | Where it is handled |
|---|---|---|
| One endpoint for every service (Tapo) | Per-service paths 404 | `XAddr` fallback, above |
| PTZ refused while privacy mode is on (Tapo) | Malformed HTTP answer, not a SOAP fault | Raised as a refusal, never as a missing capability |
| Answers a command in 2 to 3 seconds (V380) | Full await would stall stepping | Timeout treated as success |
| `RelativeMove` absent | Steps overshoot | `GetConfigurationOptions` read once per camera, `OnvifPtzProvider` falls back to move plus stop |

## Authentication

WS-Security `UsernameToken` with `PasswordDigest`: `SHA1(nonce + created + password)`, base64. The
camera account credentials are the ones on `Camera`; no vendor cloud account is ever involved.
