# Architecture decision records (ADR)

One structural decision, one file, written to [`TEMPLATE.md`](TEMPLATE.md). Writing rules and
lifecycle: DOCS-07, DOCS-08, DOCS-11, DOCS-12 and DOCS-21 to DOCS-23, DOCS-25 of
[`../rules/docs.md`](../rules/docs.md). The SAD ([`../SAD.md`](../SAD.md)) sets the boundaries and
references these ADRs rather than copying them.

| ADR | Decision |
|---|---|
| [ADR-01](0001-stack-and-runtime.md) | One .NET API holds the product, SQLite its data, in-process queues its events, and a static React interface sits in front |
| [ADR-02](0002-frigate-is-the-video-pipeline.md) | Frigate is the video pipeline, embedded unmodified, driven by a generated configuration and reached only by the API |
| [ADR-03](0003-frigate-reaches-nothing-on-the-internet.md) | Frigate reaches nothing on the internet: its version check off, the models it needs shipped, its WebRTC neutralised |
| [ADR-04](0004-the-camera-model.md) | A camera is its access, the protocols it speaks, and capabilities proven over them |
| [ADR-05](0005-camera-discovery-and-reachability.md) | Vyzio finds cameras by a unicast sweep in three stages, and watches their reachability itself |
| [ADR-06](0006-proprietary-protocols-behind-shared-transport-clients.md) | Proprietary protocols are spoken by shared transport clients, and DVRIP video reaches Frigate through go2rtc |
| [ADR-07](0007-video-streams-and-live-view.md) | A stream is one quality of one scene with its own role, every stream goes through go2rtc, and the API relays the live view |
| [ADR-08](0008-the-detection-engine-adapts-itself.md) | The detection engine adapts itself to the hardware and to each scene |
| [ADR-09](0009-ptz-positions-resolved-above-the-protocol.md) | PTZ positions are resolved above the protocol, the camera holding its own when it can |
| [ADR-10](0010-privacy-mode-cumulative-layers.md) | Privacy mode stacks what the camera can do on an engine stop that always happens |
| [ADR-11](0011-image-settings-read-and-written-live.md) | Image settings are a capability read and written live on the camera, never persisted |
| [ADR-12](0012-the-history-is-frigates-list-enriched-on-read.md) | The history is Frigate's list, enriched on read; retention is three durations, the history's never below a day |
| [ADR-13](0013-frigate-recognises-vyzio-keeps-the-people.md) | Frigate recognises faces; Vyzio keeps the people, their photos and their notification policy |
| [ADR-14](0014-notifications-and-commands-through-opt-in-messaging-channels.md) | Notifications leave through opt-in messaging channels that carry the image, and the same channels take commands back |
| [ADR-15](0015-settings-model-schedules-and-edit-cycle.md) | A setting is an installation value a camera may override, declared once, saved without restarting the engine |
| [ADR-16](0016-access-and-security.md) | An owner account and a server session guard the interface, HTTP at home, a user-operated overlay from outside |
| [ADR-17](0017-help-lives-in-the-interface-three-levels.md) | Help lives in the interface, at three levels |
