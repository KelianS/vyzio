# TAD: how Vyzio reaches a camera, access, protocols and capabilities

> How a camera's connection data is kept and used. The *why* is in
> [ADR-61](../adr/0061-camera-connection-data-on-three-levels-access-protocols-capabilities.md) (three
> levels), [ADR-22](../adr/0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md)
> (capabilities decoupled from the brand), [ADR-28](../adr/0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md)
> (detection cascade), [ADR-19](../adr/0019-dvrip-xmeye-protocol-go2rtc-as-a-fallback-gateway-transparent-to-frigate.md)
> (DVRIP through go2rtc), [ADR-38](../adr/0038-camera-stream-model-one-stream-one-quality-separate-detect-and-record-roles.md)
> (streams) and [ADR-65](../adr/0065-each-video-stream-is-a-checked-object-with-a-role-under-the-stream-binding.md)
> (a role and a check per stream). ONVIF has its own TAD, [`onvif.md`](onvif.md).
> Home of the code: `Vyzio.Core/Entities/` (`Camera`, `CameraProtocol`, `CameraCapabilityBinding`,
> `CameraStream`), `Vyzio.Application/UseCases/Cameras/`, `Vyzio.Infrastructure/CapabilityProviders/`,
> `Vyzio.Infrastructure/VendorAdapters/`, `Vyzio.Infrastructure/Services/CameraProtocolProbe.cs`.

## The three levels in the code

| Level | Entity | Holds | Written by |
|---|---|---|---|
| Identity and access | `Camera` | name, host, account | onboarding, the Connexion page |
| Protocols | `CameraProtocol`, one per camera and protocol | port, ONVIF address, V380 device id, specific account, last check (reach and login) | onboarding (the stream's protocol), protocol checks, detection, the Connexion page (added, edited, removed) |
| Capabilities | `CameraCapabilityBinding`, one per camera and capability | chosen protocol, settings, last test | onboarding (the stream), detection, manual configuration |

The streams (`CameraStream`) are rows under the stream binding (ADR-65); `Camera.Streams` reads them
through `Camera.StreamBinding`, empty while the camera has none. `CameraRepository` loads a camera with
its protocols and bindings, the stream binding with its streams: a provider reaches its protocol's port
and account through the camera it is handed.

## Reaching a protocol

**Port.** `CameraProtocol.EffectivePort` is the port the user or onboarding set, otherwise the
protocol's usual port, whose single home is `ProtocolPorts` in Core. ONVIF has no usual port: its
address is asked of the camera ([`onvif.md`](onvif.md)); a port set on the ONVIF row narrows the
search to that port.

**Account.** `Camera.CredentialsFor(protocol)` returns the protocol's specific account when its row has a
user name, the camera's otherwise. Every client (RTSP verifier, Frigate generation, `OnvifClient`,
`OnvifEndpointResolver`, `DvripClient`, `V380Client`, `TapoKlapProvider`) goes through it; none reads
`Camera.Username` itself. The specific account exists for the protocol that authenticates elsewhere, such as
KLAP on a Tapo, which takes the Tapo cloud account while RTSP and ONVIF take the local one. It is
only ever presented to the camera on the local network.

**V380 device id.** Kept on the V380 row. `V380DeviceIdBootstrap` reads it from there, then asks the
ONVIF serial number, then leaves UDP discovery to `V380Client`; a found id is written back on the row
by the use case that owns the transaction.

## Does a protocol answer, with its account

`ICameraProtocolProbe` (Core) is the protocol level's contract, apart from the capability providers.
`CameraProtocolProbe` (Infrastructure) reaches the protocol, then logs in once with the account
`CredentialsFor` resolves; it never logs in where nothing answered, and never guesses an account:

| Protocol | Reached when | Logged in when |
|---|---|---|
| ONVIF | `OnvifEndpointResolver` finds the device service ([`onvif.md`](onvif.md)) | `GetDeviceInformation` is answered (`OnvifClient.CheckLoginAsync`) |
| RTSP | a TCP connection to `EffectivePort` opens within 3 seconds | `DESCRIBE` is answered, again with Basic or Digest when challenged (`RtspLogin`) |
| DVRIP | same | the login packet returns `Ret=100` (`DvripClient.CheckLoginAsync`) |
| V380 | same | the auth handshake returns a ticket for the device number (`V380Client.CheckLoginAsync`) |
| Tapo KLAP | same | the KLAP handshake succeeds (`TapoKlapProvider.CheckLoginAsync`) |

The outcome is a `ProtocolStatus`: `Answers`, `Refused` (reached, account or device number turned
down) or `Unreachable`. `CameraProtocolCheck` (Application) runs it and records `Status`, `CheckedAt`
and `LastError` on the row, creating the row when the camera had none. It checks a protocol once per
gesture (`ProtocolCheckRun`), so a detection run logs in once per protocol. A single protocol can be
checked alone (`CheckCameraProtocolUseCase`), whatever the stream's state.

Protocol tests cover reach and login (`CameraProtocolProbeTests`, `CameraProtocolUseCaseTests`);
capability tests cover the binding (`CameraCapabilityUseCaseTests`).

The reachability poller (ADR-23) knocks on the `EffectivePort` of the recording stream's protocol
(ADR-65), and skips a camera that has no stream binding.

## Testing a capability

`ProbeCameraCapabilityUseCase`:

1. The capability's protocol is checked (above). When it does not answer with its account, the binding
   fails with the protocol's reason and nothing else runs.
2. The stream is then verified (`VerifyCameraUseCase`, `StreamVerification`): the camera status, the
   streams it serves, and the binding's `Verified` and `LastError`.
3. Any other capability is probed by the provider for (capability, protocol), as in ADR-22. A
   read-only proof per capability is issue #221.

## Detection

`SeedAndProbePresetsUseCase` (ADR-28), on a recognised brand from its preset, otherwise from every
protocol with a registered provider:

1. The ONVIF address is forgotten once for the run ([`onvif.md`](onvif.md)).
2. The protocol search below runs: every candidate protocol and every row is checked once, reach and
   login.
3. Each capability tries, in priority order, only the candidates that answered, and keeps the first
   that verifies. A capability the user configured by hand keeps its protocol and is only tested
   again. When no candidate answers, a preset capability stays unverified with the reason; a blind
   one is removed.
4. A protocol row that could not be reached, that no binding uses and that holds no port, account or
   device id the user entered is removed. A refused one stays: the camera speaks it.

The stream is not part of the cascade, except on a camera that has no stream binding: before step 3
the stream is bound to the first stream protocol (RTSP, then DVRIP, the registry's order) that
answered in step 2, then verified; the next answering one is
tried when the stream check fails, and when none passes the stream is left on the first that
answered, unverified with its reason. With none answering, the stream stays "to configure". Binding the
stream this way is a connection change (below), followed by a rewrite of the generated configuration.

A manual choice (`ConfigureCameraCapabilityUseCase`) names one of the camera's protocol rows, answering
or not: a protocol the camera has no row for is refused (`protocol_not_on_camera`), and no row is
created on the side. The choice is saved, then tested, and a protocol that does not answer with its
account fails the test with its reason.

## Searching the protocols

`DetectionPlan` holds what detection tries: the preset's candidates, or every registered provider's
for a blind camera, and the stream protocols (RTSP, then DVRIP) ahead of them. `CameraProtocolSearch`
checks those candidates and every protocol the camera already has, once per gesture. It is the first
half of detection (`SeedAndProbePresetsUseCase`, the screen's "Détecter automatiquement") and, alone,
the screen's "Rechercher les protocoles" (`SearchCameraProtocolsUseCase`): that one also forgets the
ONVIF address, keeps every row the camera had with its new state, drops a try that could not be
reached, and binds or tests no capability.

## Adding and removing a protocol

`AddCameraProtocolUseCase` creates the row of a protocol the camera does not have yet, with its port
(empty: the usual one) and an optional specific account, then checks it at once. A protocol the camera
already has is refused (`protocol_exists`). `RemoveCameraProtocolUseCase` drops a row only when no
binding goes through its protocol, streams included, and refuses otherwise (`protocol_in_use`);
removing ONVIF also forgets its cached address.

## The stream

| Moment | What happens |
|---|---|
| Onboarding | The camera is created with its stream binding (RTSP or DVRIP, as discovery or the user chose), its protocol row (port from the form) and its main stream (path from the form, over RTSP), which records and detects |
| Verification | The stream's protocol is checked first; then every stream is checked (below); the camera status follows the recording stream |
| Protocol changed | A connection change: the camera is back to `needs_attention`, the generated configuration is rewritten without it until it is checked again. The streams are replaced by one main stream over the new protocol, recording and detecting, and `StreamsFoundAt` is cleared |
| Frigate generation | `FrigateConfigApplier` builds one input for the recording stream and, when it differs, one for the analysed stream, each from its own stream's protocol: an RTSP URL, or a `dvrip://` source handed to go2rtc (ADR-19) |

A camera without a stream binding is verified as not connected, stays out of the generated
configuration, and lists its stream as not configured (`GetCameraCapabilitiesUseCase`) until its
protocol is chosen.

## The streams

**Roles.** `CameraStream.Role` is `none`, `record`, `detect` or `record_and_detect`. `StreamLineup`
(Core) is the one place that changes roles, and holds the guard: exactly one stream records. Giving a
role takes it from the stream that had it; the recording stream cannot be removed or lose its record
role (`stream_records`). `Camera.RecordStream` is the stream that records; `Camera.DetectStream` is the
stream that detects, otherwise the recording stream (`Camera.DetectsOnRecordingStream`).

**Found once.** `VerifyCameraUseCase` asks `ICameraStreamEnumerator` once the camera answers. While the
binding has not found its streams yet (`CameraCapabilityBinding.StreamsFoundAt` empty), the enumerated
streams are added, and the date is set. The defaults (the most detailed records, the lightest detects,
a single one does both) apply only to a lineup still as onboarding left it; roles the user gave before
are kept. Afterwards only the measured size of a stream whose path matches is
refreshed (the main stream's size only when its path matches, ADR-38); nothing is added or removed.

**Checks.** `StreamVerification` checks each stream's own protocol, once per gesture however
many streams go through it, then asks `ICameraVerifier` about that stream: over RTSP
an `OPTIONS` on its path, over DVRIP its port. Each stream records `Verified`, `CheckedAt` and
`LastError`; the recording stream's result is the camera's and the binding's. `CheckCameraStreamUseCase`
checks one stream alone; the recording stream's check is the camera's, so it runs the whole
verification.

**Offered on demand.** `ListAvailableCameraStreamsUseCase` (`GET .../streams/available?protocol=`)
answers the add form. It checks the asked protocol first (ADR-61 c), then, when it answers, asks
`ICameraStreamEnumerator` over that protocol: ONVIF profiles for RTSP, `Simplify.Encode` for DVRIP,
the enumerator ordering them most detailed first. `StreamLineup.Offer` numbers them in that order
and names for each the line it matches (`StreamId`, by path and protocol), so the add form leaves out
what is listed. Over DVRIP, when the camera lists nothing, the main and secondary qualities of ADR-38
are offered; over RTSP nothing is, and the form keeps its typed path. Nothing is written but the
protocol's last check.

**Per stream use cases** (`CameraStreamUseCases.cs`): list, add (a protocol among the camera's rows
that can carry a stream; a path over RTSP; over DVRIP only the main stream, no path, or the secondary
one, `CameraStream.DvripSecondaryQuery`, anything else refused as `unknown_stream_path`; a role;
checked at once), change the role, remove, check; none changes a stream's path (ADR-65 e). Each
answers with the whole list, since a role change moves roles across streams, and a change that
touches what Frigate reads rewrites the generated configuration.
