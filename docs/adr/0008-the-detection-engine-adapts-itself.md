# ADR-08: The detection engine adapts itself to the hardware and to each scene

## Context

Detection runs in Frigate, driven by the configuration Vyzio generates (ADR-02). Three needs shape
how it is set:

- **The hardware varies.** A hub may carry a dedicated accelerator, an Intel graphics chip, or only
  a processor. The user must benefit from what is there without knowing it or naming it (SYS-02,
  principle 5), and a processor-only hub with several cameras must analyse fewer images per camera so
  it does not saturate (SYS-06).
- **The detector model is redistributed.** A model the engine does not carry ships inside Vyzio's
  image, and a hub works offline (ADR-03): Vyzio becomes the distributor of that model. On the field,
  the engine's default model for Intel graphics proved unreliable, and the better-known alternatives
  carry a copyleft licence or forbid commercial use.
- **The scene varies.** The detector's processor cost follows the number of inferences, and the engine
  runs one per region of motion, so a camera on foliage or changing light costs several times a stable
  indoor scene, until frames are dropped. The engine's motion sensitivity governs it, and no single
  value suits every scene. The usual remedy, drawing motion masks, is out of reach of a non-technical
  user (principle 1). The user picks what is detected (UC-DET-01) and lets Vyzio set the sensitivity
  or fixes it (UC-DET-03).

## Decision

Vyzio chooses the detector, its model, its analysis rate and each camera's motion sensitivity itself,
and writes them into the generated configuration; only the categories detected are the user's choice.

- **Hardware tiers, probed in order**: a dedicated accelerator, then an Intel graphics chip, then the
  processor. The probe reads known device paths of the host only, so a host that exposes none falls to
  the processor tier, deterministically. One plan, the tier and its analysis rate, is resolved once
  per configuration generation and read by both the configuration and the system status, never
  recomputed apart.
- **The analysis rate**: fixed on an accelerated tier; on the processor tier, a deterministic share of
  the available cores divided among the active cameras, bounded (SYS-06).
- **The model per tier**: the engine's own model on the accelerator and on the processor tier; on the
  Intel graphics tier, a permissively licensed model shipped in Vyzio's image and installed into the
  engine's model cache when absent, never downloaded (ADR-03). A detector model ships only under a
  licence that allows redistribution and commercial use, checked when it is added.
- **Motion sensitivity per camera, in three named levels**, set by a closed loop: Vyzio samples the
  engine's statistics it already reads, aggregates the inferences per frame over a long window, and
  moves the camera one level at a time when an upper percentile leaves a target band, with
  hysteresis, a rate limit and a minimum window coverage before any step. A step clears the window.
  The loop pursues load only: the lowest level is a hard floor. A camera whose statistics are missing
  is skipped, never stepped on an absent measure. Each evaluation yields an explicit outcome, the one
  reason the logs and the interface both read.
- **A level applies live**, through the engine's runtime command over its message bus (ADR-02), with
  no configuration rewrite and no restart; it is also persisted per camera and written into the
  generated configuration, which the engine reads again at its next start. The owner can pin a camera's
  level, and the loop then leaves it alone.
- **The categories detected are a per-camera list kept on the camera** and read whole when the
  configuration is generated, checked against a reference list Vyzio holds; a camera with none
  detects people. A change follows the settings cycle of ADR-15.

## Consequences

- ✅ A hub uses its accelerator or graphics chip with no setting, and a processor-only hub stays
  fluid as cameras are added.
- ✅ A noisy scene stops starving the others without the user learning what motion detection is, and
  the level always comes with its reason (principle 4).
- ✅ The tier, the rate and the level are enums translated into the engine's vocabulary in one place:
  no engine string is compared anywhere else (COMMON-04).
- ⚠️ The engine and the API see the host's devices: the engine container runs privileged with the
  host's devices mounted, which also replaces its shared memory, mounted again on its own.
- ⚠️ A USB accelerator is not detected, and Nvidia or AMD graphics fall to the processor tier. The
  model chosen for the Intel tier is a reasonable estimate, not benchmarked across varied hardware.
- ⚠️ Vyzio's image carries the Intel tier's model, fetched once at build time.
- ⚠️ The loop is inert during its warm-up, again after every restart of the API, since its window
  lives in memory.
- ⚠️ Inferences per frame measure motion, not real activity: a camera that is busy for good reasons is
  desensitised too. The hard floor and pinning are the mitigation; a desensitised camera may miss a
  distant or low-contrast object, a trade-off only an accelerator or a mask lifts.

## Options rejected

| Option | Why rejected |
| --- | --- |
| A fixed processor detector at a fixed rate for every hub | Wastes the accelerator a user owns and saturates a small processor as cameras are added (SYS-02). |
| Manual choice of the detector and model | The user would have to know the hardware and the engine's vocabulary (principles 1 and 2). |
| Nvidia and AMD support by switching the engine to another image variant at apply time | Pulls an image that may be absent offline, and a failed pull or recreation can break a working system. |
| A copyleft-licensed model on the Intel tier | Vyzio would distribute a derived binary under a copyleft licence. |
| A model whose pre-trained weights forbid commercial use | Its licence forbids it. |
| Converting the processor tier's model for the Intel tier | Unsupported by the engine; a mismatch would calibrate detections wrongly with no visible error. |
| The Intel tier's model on the processor tier too | Measured: processor peaks and dropped frames with two cameras; a heavier model pays only where dedicated hardware absorbs it. |
| A rate steered continuously by the observed processor load | Disproportionate, and invites oscillation; a bounded deterministic share covers the need. |
| One indoor or outdoor question at onboarding | The right level depends on the real scene and changes with the seasons; at most an initial value, not retained. |
| Motion masks drawn by the user | Requires drawing zones and understanding the engine's notion of motion (principles 1 and 2). |
| Deciding on instantaneous samples, confirmed over a few measures | The ratio reflects activity at the moment: the camera would desensitise every day and sensitise every night. |
| The mean over the window rather than an upper percentile | Quiet hours pull it down until a noisy camera no longer stands out. |
| A continuous sensitivity value | Invites oscillation and cannot be explained; three named levels bound the worst case. |
| Steering other motion settings in the same loop | Interdependent settings make convergence hard to reason about and to test. |
| Lowering the detection resolution | Motion is already analysed on a reduced image, so the number of inferences barely changes. |
| A second detector instance | Pays only with unused hardware; on a saturated processor it adds load. |
| Detection categories as fixed presets, or as a table of their own | Presets make combinations impossible; a table adds a join for a list only ever read whole. |
