# ADR-56: The ONVIF endpoint is asked of the camera, never assumed by convention

> Status: Accepted

## Context

`OnvifClient` builds the address of every call from a hardcoded convention:

```
http://{host}:8899/onvif/{service}
```

Two assumptions are baked into that line, and a TP-Link Tapo C200 falsifies both. Its ONVIF service
answers on port **2020**, not 8899. And it exposes **one single endpoint**, `/onvif/service`, serving
device, media, PTZ and imaging alike, where V380 and XM firmwares expose one path per service. Neither
is exotic: ONVIF standardises the SOAP contract, never the port, and never the path.

The consequence is not a degraded Tapo, it is a mute one. Every ONVIF call fails at the transport
layer, so the capability probe concludes the camera has no PTZ. Hardware testing proved the opposite:
pan, tilt, absolute, relative and continuous moves, presets and imaging all work over ONVIF on this
camera, with the local camera account alone (see issue #89 for the measurements).

The same convention is written a second time in the discovery pipeline, whose ONVIF fingerprint posts
to `/onvif/device_service`. A Tapo therefore also fails to be recognised as an ONVIF device at
discovery time, and its open port 2020 surfaces as unidentified.

Fixing the port alone would be a trap: the next brand will move the path instead, and a
`if (vendor == Tapo)` branch would contradict ADR-22, which resolves capabilities by protocol and
never by brand.

## Decision

**a) The client stops constructing addresses and asks the device.** ONVIF answers this question
itself: `GetCapabilities` and `GetServices` return an `XAddr` per service. Only the entry point, the
device service, has to be found; everything downstream is read from the device's own answer. A service
with no `XAddr` falls back to the device service URL, which is exactly the single-endpoint behaviour a
Tapo needs, obtained without naming Tapo anywhere.

**b) An `OnvifEndpointResolver` owns that resolution**, and `OnvifClient` asks it for a URL instead of
formatting one. The cascade, cheapest first: the endpoint persisted for this camera, then the ONVIF
port list of `DiscoveryPortCatalog` crossed with a short list of candidate paths, then the per-service
addresses the device announces. The first port and path that answers wins. The *how* of the cascade is in the TAD
([`design/onvif.md`](../design/onvif.md)), not here.

**c) The identification probe is credential-free.** `GetSystemDateAndTime` is defined by the ONVIF
core specification as requiring no authentication, so a sweep never presents credentials to a port
that may not even be a camera. This is a safety property, not an optimisation: presenting credentials
repeatedly is what locks a Tapo account out for twenty-five minutes.

**d) The resolved endpoint is stored on the camera, in `Camera.ProtocolEndpointsJson`**, keyed by
`SupportedProtocol`. It describes the **device**, not one of its capabilities, so `ConfigJson` on
`CameraCapabilityBinding` is the wrong home: three capabilities would hold three copies of one fact,
and the callers that use ONVIF without any binding (`CameraStreamEnumerator`, `V380DeviceIdBootstrap`)
would still be left resolving it themselves. The column mirrors `SupportedProtocolsJson`, already on
`Camera`, and is written by the use-case layer at probe time, as the V380 device id already is.

**e) An ONVIF command reports its failure instead of hiding it.** Command sends were fire-and-forget
behind a 500 ms timeout, so a refused move was indistinguishable from an accepted one. A definite
refusal (an HTTP error status, a SOAP fault) now raises `OnvifCallException` and travels up to the
interface. A timeout stays a success: budget cameras execute the command on TCP receipt and answer
seconds later, and treating their slowness as an error would break V380, which is the reason the
fire-and-forget existed.

That distinction is what makes the Tapo privacy trap legible. With privacy mode on, the camera refuses
PTZ and answers with a malformed HTTP response; silently swallowed, it reads as a camera without PTZ,
and the probe marks the capability dead for good.

## Options rejected

**Correcting the port to 2020 for the Tapo preset.** Cheapest, and wrong twice over: it leaves the
per-service path assumption in place, which is the half that actually breaks on this camera, and it
carries a brand into a protocol client that ADR-22 keeps brand-free.

**Making the port a user-visible setting.** It works, and it is the opposite of the product promise
(principle 5, plug and play): asking a non-technical owner for an ONVIF port is asking them to know
what ONVIF is. The port remains overridable through the existing manual capability configuration
(ADR-28) for the unit that defeats automatic resolution, which is a fallback, not the nominal path.

**A dedicated `camera_protocol_endpoints` table.** Cleaner in the abstract. It buys a join and a
migration to store one scalar per protocol, where a JSON column on `Camera` follows a pattern already
in place. To be reconsidered if an endpoint ever needs its own lifecycle (freshness, history).

**Awaiting every command in full.** It would surface Tapo failures perfectly and make every V380 step
command wait two to three seconds, ruining PTZ responsiveness on the cameras that work today.

## Consequences

- ✅ Tapo PTZ and imaging become reachable, and Tapo PTZ moves to ONVIF as its primary protocol
- ✅ The next ONVIF camera with a different port or path needs no code: a catalogue entry at most, and
  nothing at all when its port is already scanned
- ✅ Discovery and the client ask the same question the same way (`OnvifServiceProbe`, plus the ports
  and paths of `DiscoveryPortCatalog`), so a camera recognised at discovery is one the client can
  reach. Their transports stay distinct, a raw socket to sweep a subnet against `HttpClient` for a
  known camera
- ⚠️ Discovery confirms the ONVIF port of a camera and that finding is dropped at onboarding, which
  only carries host, RTSP port and vendor: the resolver sweeps again for its first call. Correct, but
  work done twice, and worth carrying through the onboarding contract
- ✅ A refused PTZ command becomes visible to the user instead of failing silently
- ⚠️ The first ONVIF call on a camera with no persisted endpoint pays a port sweep. It is bounded by
  the catalogue, runs against a LAN where a closed port refuses immediately, and is paid once
- ✅ Testing a capability, or re-running capability detection, drops the remembered address first, so
  a service enabled on the camera since last time is found without deleting and re-adding it
- ⚠️ A camera that moves its ONVIF endpoint (a firmware update changing the port) keeps a stale
  persisted address until one of those two gestures is made: nothing notices on its own
