# ADR-56: The ONVIF endpoint is asked of the camera, never assumed by convention

> Status: Accepted
>
> Amends [ADR-21](0021-ptz-parking-and-a-generic-onvif-adapter-a-layered-privacy-mode-strategy.md) and
> [ADR-27](0027-advanced-image-settings-imagesettings-capability-onvif-imaging-service-values-not-persisted.md)
> on the ONVIF port they assume (8899), and
> [ADR-22](0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md)
> on where an ONVIF address lives (not in a binding's `ConfigJson`).

## Context

`OnvifClient` built the address of every call from a hardcoded convention:

```
http://{host}:8899/onvif/{service}
```

Two assumptions are baked into that line, and a TP-Link Tapo C200 falsifies both. Its ONVIF service
answers on port **2020**, not 8899. And it exposes **one single endpoint**, `/onvif/service`, serving
device, media, PTZ and imaging alike, where V380 and XM firmwares expose one path per service. Neither
is exotic: ONVIF standardises the SOAP contract, never the port, and never the path.

The consequence is not a degraded Tapo, it is a mute one. Every ONVIF call fails at the transport
layer, so the capability probe concludes the camera has no PTZ. Hardware testing proved the opposite:
pan, tilt, moves, presets and imaging all work over ONVIF on this camera, with the local camera account
alone (see issue #89 for the measurements).

The same convention is written a second time in the discovery pipeline, so a Tapo also fails to be
recognised as an ONVIF device at discovery time.

Fixing the port alone would be a trap: the next brand will move the path instead, and a
`if (vendor == Tapo)` branch would contradict ADR-22, which resolves capabilities by protocol and
never by brand.

## Decision

**a) The client stops constructing addresses and asks the device.** ONVIF answers this question
itself: `GetServices` returns an `XAddr` per service. Only the entry point, the device service, has to
be found; everything downstream is read from the device's own answer. A service with no `XAddr` is
addressed at the device service, which is exactly the single-endpoint behaviour a Tapo needs, obtained
without naming Tapo anywhere.

**b) An `OnvifEndpointResolver` owns that resolution**, and `OnvifClient` asks it for a URL instead of
formatting one. Discovery asks the camera the same question the same way. How the resolver searches,
in which order, on which ports and paths, is in the TAD ([`design/onvif.md`](../design/onvif.md)).

**c) Resolving the endpoint never guesses a credential.** A port that may not even be a camera is asked
a question the ONVIF core specification defines as unauthenticated, and the services are asked the
same way; the camera's own account is presented only where it demands one. This is a safety
property, not an optimisation: repeated credentialed guesses lock some camera accounts out.

**d) The resolved endpoint is stored on the camera, in `Camera.ProtocolEndpointsJson`**, keyed by
`SupportedProtocol`. It describes the **device**, not one of its capabilities, so `ConfigJson` on
`CameraCapabilityBinding` is the wrong home: three capabilities would hold three copies of one fact,
and the callers that use ONVIF without any binding (`CameraStreamEnumerator`, `V380DeviceIdBootstrap`)
would still be left resolving it themselves. The column mirrors `SupportedProtocolsJson`, already on
`Camera`. The user can make Vyzio forget it and ask again.

**e) A command that does not go through says so, and says which way.** A camera that **refused** (an
error status, a SOAP fault, or a malformed answer, the way a Tapo refuses PTZ in privacy mode) and a
camera that **could not be reached** (no connection, no ONVIF service found) are two different things
for the user and for support. Each leaves the API with its own error code, never as an unexplained server error,
and reaches the screen as a plain sentence with the camera's answer in the diagnostic line
([SPECS](../SPECS.md) 1.5). Silence within a short wait stays a success: budget cameras execute a
command on receipt and answer seconds later, and treating their slowness as an error would break V380.

## Options rejected

**Correcting the port to 2020 for the Tapo preset.** Cheapest, and wrong twice over: it leaves the
per-service path assumption in place, which is the half that actually breaks on this camera, and it
carries a brand into a protocol client that ADR-22 keeps brand-free.

**Making the port a user-visible setting.** It works, and it is the opposite of the product promise
(principle 5, plug and play): asking a non-technical owner for an ONVIF port is asking them to know
what ONVIF is.

**Storing the endpoint in each binding's `ConfigJson`.** Rejected in d): one device fact copied three
times, and unreachable from the callers that hold no binding.

**A dedicated `camera_protocol_endpoints` table.** Cleaner in the abstract. It buys a join and a
migration to store one scalar per protocol, where a JSON column on `Camera` follows a pattern already
in place. To be reconsidered if an endpoint ever needs its own lifecycle (freshness, history).

**Awaiting every command in full.** It would surface Tapo failures perfectly and make every V380 step
command wait two to three seconds, ruining PTZ responsiveness on the cameras that work today.

**Naming a refusal by its HTTP status alone.** A proxy in front of the API answers 502 by itself when
the API is down: a status shared with a camera refusal would read a server outage as the camera's
fault. The refusal is named by its error code.

## Consequences

- ✅ Tapo PTZ and imaging become reachable, and Tapo PTZ moves to ONVIF as its primary protocol
- ✅ The next ONVIF camera with a different port or path needs no code: a catalogue entry at most, and
  nothing at all when its port is already scanned
- ✅ A camera recognised at discovery is one the client can reach: they ask the same question
- ✅ A refused PTZ command becomes visible to the user, and a camera that cannot be reached no longer
  passes for one that refused
- ⚠️ Discovery confirms the ONVIF port of a camera and that finding is dropped at onboarding, which
  only carries host, RTSP port and vendor: the resolver searches again for its first call. Correct,
  but work done twice, and worth carrying through the onboarding contract
- ⚠️ The first ONVIF call on a camera with no stored endpoint pays a search, bounded by the catalogue
  and paid once
- ⚠️ A camera that moves its ONVIF endpoint (a firmware update changing the port) keeps a stale
  stored address until the user asks Vyzio to look at it again: nothing notices on its own
