# ADR-70: Frigate reaches nothing on the internet: version check off, models shipped, WebRTC neutralised

> Status: Accepted

## Context

Vyzio promises that nothing leaves the house unless the user set it up ([SPECS](../SPECS.md) 8.2),
and that local surveillance keeps working without internet ([SPECS](../SPECS.md) 5.3). Vyzio decides
what its own code sends; Frigate, which it runs as an implementation detail (ADR-01), also opens
connections of its own. Read in the code of the pinned Frigate (0.17.2) with the configuration Vyzio
generates (#250):

- **The release version check.** At every start, Frigate asks GitHub's API for its latest release, to
  show it in its own interface (`frigate/stats/util.py`). It is on by default and skipped only when
  the telemetry setting that controls it is off (`frigate/config/telemetry.py`). No image goes with
  it, but the hub tells GitHub when it starts and which address it has.
- **The face recognition models.** Face recognition is Frigate's (ADR-03), and the generated
  configuration turns it on as soon as one camera is active, with Frigate's default small model.
  Frigate then needs three files in its model cache: a face detector, a landmark model that aligns
  the face, and the embedding model. Each one it does not find there is downloaded from GitHub, about
  150 MB in all, the first time
  (`frigate/data_processing/real_time/face.py`, `frigate/embeddings/onnx/face_embedding.py`, through
  `frigate/util/downloader.py`). It looks only at whether the file exists: a file already there is
  never fetched. Until the download completes, recognition does not work, and on a hub with no
  internet it never does.
- **WebRTC.** go2rtc, inside the Frigate container, runs a WebRTC server. When the configuration
  names no candidates, Frigate adds a STUN candidate to it (its go2rtc `create_config.py`), and go2rtc
  keeps a public STUN server by default. The first WebRTC session would ask that server for the
  hub's public address. Vyzio never opens one, its live view is a refreshed still image (ADR-16), but
  nothing in the configuration forbids it.

The three files come from one release of a repository kept by a Frigate maintainer, published under
Apache-2.0. Traced to their origin: the face detector is byte for byte OpenCV Zoo's quantised YuNet,
under MIT; the embedding model is the Inception-ResNet-v1 FaceNet of the `davidsandberg/facenet`
project, under MIT; the landmark model is byte for byte the LBF model trained for OpenCV's facemark
module during Google Summer of Code 2017, published in a repository that carries no licence of its
own.

The other features of Frigate that reach the internet (Frigate+, semantic search, licence plate
recognition, generative AI descriptions, bird and audio classification, the large face model) are
off in Vyzio's configuration, which leaves them at Frigate's defaults.

## Options compared

| Option | Description | For | Against |
|---|---|---|---|
| **A. Accept and document the calls** | The SAD lists both flows, the product says nothing | Nothing to build | The hub talks to GitHub at every start, and face recognition depends on internet the first time, both without the user knowing |
| **B. Version check off, model download accepted** | Turn the check off; let Frigate fetch the face models once, and say so in the product | Nothing to ship in the image | The first recognition still needs internet; a hub installed offline never recognises anyone; the interface would have to explain a download of a component the user never sees |
| **C. Version check off, models shipped, WebRTC neutralised, and a rule for what comes next** | Turn the check off; ship the face models with Vyzio as ADR-34 already does for the detector model; give go2rtc no STUN; decide any future internet-reaching feature in an ADR | Frigate opens no flow to the internet; recognition works offline from the first start; the next feature cannot add a flow by accident | The API image grows by the size of the models; their licences must be checked before each one ships |
| **D. Frigate on an internal Docker network** | A network with no route out, so Frigate cannot reach the internet whatever its configuration | Enforced by the network, not by a configuration that could drift | Frigate reads the cameras on the home network: an internal network cuts them off too |
| **E. A local mirror for the downloads** | Point Frigate's download endpoint at a server in the stack that serves the same files | Frigate's own download path, unchanged | One more container to run and keep, holding the same files Vyzio would ship anyway; the version check is untouched |

**Option C chosen.**

## Decision

**a) The rule.** The configuration Vyzio generates turns on no Frigate feature that reaches the
internet unless an ADR decides it, and never one that sends an image or biometric data out of the
house without the user's explicit consent. The features listed in the context stay off until such an
ADR. A detector that needs a model Frigate does not carry ships that model with Vyzio, as ADR-34's
Intel GPU tier does: a tier never relies on a download.

**b) The version check is off.** Vyzio pins Frigate and moves it through an issue (SAD § 9); a latest
release shown in an interface the user never sees serves no one.

**c) The face recognition models ship with Vyzio.** The files Frigate's small face model needs are
bundled in the API image, and copied into Frigate's model cache in the shared configuration volume the
way ADR-34 installs the detector model: under the exact path and name Frigate looks for, only when
absent, before the configuration that turns recognition on is applied. Frigate finds them and never
downloads them. The large face model stays off.

Every model Vyzio ships has its licence checked and stated when it is added: Vyzio redistributes it.
A model whose licence forbids redistribution never ships, and the feature that needs it waits for its
own ADR. The face models' licences are in the context; the landmark model's missing licence is put to
the owner with the change that ships it.

**d) WebRTC is neutralised.** The generated configuration gives go2rtc no WebRTC candidates and no
ICE servers, so no STUN request ever leaves the hub. The live view does not use WebRTC (ADR-16); a
real stream (#47) would decide its own transport in its own ADR.

**e) It is kept true at each Frigate upgrade.** Moving Frigate to a new version means reading its
outbound calls again against this rule: a new default that reaches the internet is turned off in the
generated configuration, or decided in an ADR.

## Options rejected

**Accepting and documenting the calls (A).** It keeps two flows the user never asked for, one at every
start, and makes the first recognition depend on internet: the opposite of SPECS 5.3 and 8.2.

**Accepting the one-time download (B).** A hub installed without internet would never recognise a
face, with no visible reason; explaining it would name a component the user must never see
(principle 2).

**An internal Docker network for Frigate (D).** Frigate pulls every stream from the cameras on the
home network; a network with no route out cuts them off along with the internet.

**A local mirror (E).** It serves the files Vyzio would otherwise ship, at the cost of one more
container, and leaves the version check and WebRTC untouched.

## Consequences

- ✅ Frigate opens no flow to the internet: the SAD's network flows list none
- ✅ Face recognition works from the first start, with or without internet
- ✅ A future Frigate feature that would reach the internet is decided, never inherited from a default
- ⚠️ The API image carries the face models, fetched once at build time
- ⚠️ The guarantee rests on the generated configuration and on reading each new Frigate version: the
  network does not enforce it
- ⚠️ The landmark model has no licence of its own upstream: it ships under the Apache-2.0 release
  that republishes it, a choice the owner confirms when the change that ships it is reviewed
