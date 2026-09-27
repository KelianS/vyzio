# TAD: the ONVIF client and endpoint resolution

> How Vyzio talks ONVIF. The *why* behind the choices is in
> [ADR-56](../adr/0056-the-onvif-endpoint-is-asked-of-the-camera-not-assumed-by-convention.md)
> (endpoint asked of the camera), [ADR-61](../adr/0061-camera-connection-data-on-three-levels-access-protocols-capabilities.md)
> (where it is kept, on the ONVIF protocol row), [ADR-22](../adr/0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md)
> (resolution by protocol, never by brand) and
> [ADR-28](../adr/0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md) (capability cascade),
> [ADR-24](../adr/0024-protocol-layer-separated-from-capability-layer-onvifclient-supportedprotocol-privacystrategy.md)
> (the client is transport only),
> [ADR-25](../adr/0025-ptz-position-management-native-presets-branch-a-vs-vyzio-managed-positions-branch-b.md) (native PTZ presets) and
> [ADR-27](../adr/0027-advanced-image-settings-imagesettings-capability-onvif-imaging-service-values-not-persisted.md) (imaging).
> Home of the code: `src/vyzio/Vyzio.Infrastructure/VendorAdapters/OnvifClient.cs`,
> `OnvifEndpointResolver.cs`, and the providers in `Vyzio.Infrastructure/CapabilityProviders/`.

## Role

Speak ONVIF to any compliant camera, whatever port and path that camera happens to serve it on, and
whatever brand is on the box. Feature logic (PTZ steps, imaging, native presets) lives in the providers; this
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

1. **Stored.** The `Endpoint` of the camera's ONVIF protocol row (`CameraProtocol`,
   [`camera-connection.md`](camera-connection.md)), taken as-is: only a real resolution writes it, and
   a stale one surfaces as a failed call. No sweep.
2. **Swept**, when nothing is stored. The ONVIF ports of `DiscoveryPortCatalog`, or only the port set
   on the ONVIF row when there is one, crossed with the candidate paths below. First answer wins, and
   becomes the device service URL.
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

Both halves are dropped together, the ONVIF row's `Endpoint` and the process-wide cache behind
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
  With `throwOnFailure: true` a failure is raised instead of returning nothing, so the imaging probe
  can say *why* instead of reporting an unsupported capability. The PTZ probe asks without it and
  reads silence as no PTZ (below).
- **Commands** (moves, presets, `SetImagingSettings`) wait 1.5 s for an answer, 300 ms for the start of
  a continuous move, which a step stops shortly after. **Silence is treated as success**: budget cameras execute on TCP receipt and answer seconds later, and PTZ steps cannot wait
  for them. Anything else that goes wrong is raised, and classified below.

A failure is one of two things, both in `Vyzio.Core/Interfaces/CameraCommandException.cs`:

| The camera… | Examples | Raised as | API code |
|---|---|---|---|
| answered, and said no | an error status, a SOAP fault, a malformed answer, an unreadable body | `CameraCommandRefusedException` | `camera_refused` |
| could not be reached | connection refused, no route, no ONVIF service found | `CameraUnreachableException` | `camera_unreachable` |

A malformed answer, `HttpRequestError.InvalidResponse`, means the camera spoke, badly: it is how a Tapo
C200 refuses PTZ in privacy mode, measured on the device. An answer cut off half way (`ResponseEnded`)
looks like a dropped connection as much as a refusal, and is read as unreachable, like every other
transport error. The message of either exception is support detail: the service,
the status, the SOAP fault or the transport error, never a credential. `CameraCommandExceptionHandler`
turns both into a 502 whose body carries the code and that message; the interface branches on the code,
never on the status, which a proxy in front of the API also sends.

## The PTZ probe

A binding is `verified` only after a real test ([SAD](../SAD.md#7-data-model) section 7,
[ADR-28](../adr/0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md)), and answering
ONVIF is not doing PTZ over it: a camera can serve its media profiles over ONVIF with no PTZ service
behind them. `OnvifPtzProvider.ProbeAsync` verifies on the camera's own PTZ description, never on a
guess:

1. `GetProfiles`: the first media profile must carry a `PTZConfiguration` token. Without one the probe
   answers no; no default token is substituted.
2. `GetConfigurationOptions` on that token must answer with `PTZConfigurationOptions`. Silence, a
   refusal or an answer without them, and the probe answers no. The same answer says whether
   `RelativeMove` is offered.
3. `GetPresets` counts the native presets
   ([ADR-25](../adr/0025-ptz-position-management-native-presets-branch-a-vs-vyzio-managed-positions-branch-b.md)); it does not weigh on the verdict.

The probe never moves the camera: a pan at onboarding is a side effect the user did not ask for. A no
lets the cascade move on to the next candidate protocol; a binding the user chose by hand keeps its
protocol whatever the verdict (ADR-28).

## Known camera behaviours

| Behaviour | Effect | Where it is handled |
|---|---|---|
| One endpoint for every service (Tapo) | Per-service paths 404 | `XAddr` fallback, above |
| PTZ refused while privacy mode is on (Tapo) | Malformed HTTP answer, not a SOAP fault | Raised as a refusal, never as a missing capability |
| Speaks ONVIF without PTZ over it (some ICSee units) | Media profile carries no `PTZConfiguration` | The PTZ probe answers no, the cascade falls through to DVRIP |
| Answers a command in 2 to 3 seconds (V380) | Full await would stall stepping | Timeout treated as success |
| `RelativeMove` absent | Steps overshoot | `GetConfigurationOptions` read when the profile carries a PTZ configuration, a real answer kept for the request; without one, `OnvifPtzProvider` falls back to move plus stop |

## Authentication

WS-Security `UsernameToken` with `PasswordDigest`: `SHA1(nonce + created + password)`, base64. The
account is the one `Camera.CredentialsFor(Onvif)` resolves: the ONVIF row's own account when set, the
camera's otherwise ([`camera-connection.md`](camera-connection.md)). No vendor cloud account is
involved.
