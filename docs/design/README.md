# Technical architecture documents (TAD)

A **TAD** describes **how** a subsystem works: the detail too specific for the SAD (boundaries) and too
cross-cutting for an ADR (one decision). It **references** the code and the ADRs, it does not copy them
(supreme zero-duplication rule, [`../CLAUDE.md`](../CLAUDE.md)). Role and lifecycle:
[`../WORKFLOW.md`](../WORKFLOW.md).

The chain: SAD (boundaries), ADR (decision and why), **TAD (how)**, code (does).

## Catalogue

| Component | TAD | Source decisions | Home of the code |
|---|---|---|---|
| Camera network discovery | [`camera-discovery.md`](camera-discovery.md) | ADR-31, ADR-32 | `Vyzio.Infrastructure/Services/CameraDiscovery/` |
| ONVIF client and endpoint resolution | [`onvif.md`](onvif.md) | ADR-24, ADR-27, ADR-56 | `Vyzio.Infrastructure/VendorAdapters/` |
| DVRIP client and its PTZ, native preset detection | [`dvrip.md`](dvrip.md) | ADR-25, ADR-29, ADR-59, ADR-60, ADR-64 | `Vyzio.Infrastructure/VendorAdapters/Dvrip*.cs`, `Vyzio.Infrastructure/CapabilityProviders/DvripPtzProvider.cs` |
| Reaching a camera: access, protocols, capabilities | [`camera-connection.md`](camera-connection.md) | ADR-19, ADR-22, ADR-28, ADR-38, ADR-61 | `Vyzio.Core/Entities/`, `Vyzio.Application/UseCases/Cameras/`, `Vyzio.Infrastructure/CapabilityProviders/` |

## Candidate components (detail still carried by their ADRs and the code)

These subsystems have a *how* rich enough to deserve a TAD of their own the day their detail gets in
the way of reading their ADRs. As long as it holds, the detail stays in the ADR and the code. Do not
create an empty TAD in anticipation.

- **Camera protocol clients**: the V380 wire protocol, the capability registry, `PrivacyStrategy`.
  How a camera is reached, and DVRIP, are in the TADs above. Sources: ADR-20, ADR-24, ADR-29,
  ADR-30, ADR-60.
- **Frigate integration**: the MQTT and REST contract consumed, `FrigateAdapter`, `config.yml`
  generation (its stream input is in `camera-connection.md`). Sources: ADR-04, ADR-05, ADR-13, ADR-16, ADR-17, ADR-18.
- **PTZ and positions**: native presets against Vyzio-managed ones, thumbnails. Sources: ADR-21,
  ADR-25, ADR-26, ADR-59, ADR-60.
