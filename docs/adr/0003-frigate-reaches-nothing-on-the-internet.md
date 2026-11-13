# ADR-03: Frigate reaches nothing on the internet: its version check off, the models it needs shipped, its WebRTC neutralised

## Context

Nothing leaves the house unless the user set it up ([SPECS](../SPECS.md) SEC-01), and local
surveillance keeps working without internet ([SPECS](../SPECS.md) SYS-03). Vyzio decides what its
own code sends; Frigate (ADR-02) also opens connections of its own. Read in the code of the pinned
Frigate, with the configuration Vyzio generates:

- **The release version check.** At every start, Frigate asks GitHub for its latest release, to
  show it in its own interface. It is on by default, off only when its telemetry setting says so.
  No image goes with it, but it tells GitHub when the hub starts and from which address.
- **The face recognition models.** Recognition is Frigate's (ADR-13), turned on as soon as one
  camera is active, with its small face model. That model needs three files (a face detector, a
  landmark model, an embedding model); each one missing from its model cache is downloaded from
  GitHub the first time, and only when missing. Until then recognition does not work, and on a hub
  with no internet it never does.
- **WebRTC.** go2rtc, inside Frigate's container, runs a WebRTC server. With no candidate
  configured, Frigate adds a STUN one, and go2rtc keeps a public STUN server by default: a first
  WebRTC session would ask it for the hub's public address. Vyzio's live view never opens one
  (ADR-07), but nothing forbade it.

The three face files come from one release republished under Apache-2.0 by a Frigate maintainer.
Traced to their origin, the detector and the embedding model are under MIT; the landmark model
comes from a repository that carries no licence of its own.

Frigate's other internet-reaching features (its paid model service, semantic search, licence
plates, generated descriptions, bird and audio classification, the large face model) are off at
its defaults, which Vyzio's configuration leaves untouched.

## Decision

The configuration Vyzio generates turns on no Frigate feature that reaches the internet unless an
ADR decides it, and never one that sends an image or biometric data out of the house without the
user's explicit consent.

- **The version check is off.** Vyzio pins Frigate and moves it deliberately; a release shown in
  an interface the user never sees serves no one.
- **Every model Frigate needs ships with Vyzio.** The face files are bundled in the API image,
  pinned by digest, and copied into Frigate's model cache in the shared folder under the exact name
  Frigate looks for, only when absent, before the configuration that turns recognition on is
  applied. A detector tier that needs a model Frigate lacks ships it the same way (ADR-08): no tier
  relies on a download. The large face model stays off.
- **A shipped model has its licence checked and stated when it is added**: Vyzio redistributes it.
  A model whose licence forbids redistribution never ships, and the feature that needs it waits for
  its own ADR.
- **WebRTC is neutralised.** The generated configuration gives go2rtc no candidate and no ICE
  server, so no STUN request leaves the hub.
- **Each Frigate upgrade reads its outbound calls again** against this rule: a new default that
  reaches the internet is turned off in the generated configuration, or decided in an ADR.

## Consequences

- ✅ Frigate opens no flow to the internet; the SAD's network flows list none.
- ✅ Face recognition works from the first start, with or without internet.
- ✅ A future Frigate feature that reaches the internet is decided, never inherited from a default.
- ⚠️ The API image carries the models, fetched once at build time, and grows by their size.
- ⚠️ The guarantee rests on the generated configuration and on reading each new Frigate version:
  the network does not enforce it.
- ⚠️ The landmark model has no licence of its own upstream: it ships under the Apache-2.0 release
  that republishes it, a choice the owner confirms.

## Options rejected

| Option | Why rejected |
| --- | --- |
| Accept and document the calls | Two flows the user never asked for, one at every start, and a first recognition that needs internet: against SYS-03 and SEC-01 |
| Version check off, the one-time model download accepted | A hub installed offline never recognises anyone, for no visible reason; explaining it would name a component the user never sees (principle 2) |
| Frigate on an internal Docker network with no route out | Frigate reads the cameras on the home network: such a network cuts them off along with the internet |
| A local mirror serving the downloads | One more container holding the files Vyzio would ship anyway, and the version check and WebRTC left untouched |
