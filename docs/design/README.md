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

## Candidate components (detail still carried by their ADRs and the code)

These subsystems have a *how* rich enough to deserve a TAD of their own the day their detail gets in
the way of reading their ADRs. As long as it holds, the detail stays in the ADR and the code. Do not
create an empty TAD in anticipation.

- **Camera protocols and capabilities**: the ONVIF, DVRIP and V380 clients, the capability registry,
  `PrivacyStrategy`. Sources: ADR-19, ADR-20, ADR-22, ADR-24, ADR-27, ADR-28, ADR-29, ADR-30.
- **Frigate integration**: the MQTT and REST contract consumed, `FrigateAdapter`, `config.yml`
  generation. Sources: ADR-04, ADR-05, ADR-13, ADR-16, ADR-17, ADR-18.
- **PTZ and positions**: native presets against Vyzio-managed ones, thumbnails. Sources: ADR-21,
  ADR-25, ADR-26.
