# Architecture decision records (ADR)

One architectural decision, one file. Format: Context, Options compared, Decision, Consequences
(including "Options rejected"). Writing rules and lifecycle:
[`../WORKFLOW.md`](../WORKFLOW.md). The SAD ([`../SAD.md`](../SAD.md)) sets the boundaries and
references these ADRs rather than copying them.

> The ADR bodies are still French, the filenames are English. Content translation is tracked as a
> separate piece of work, see [`../WORKFLOW.md`](../WORKFLOW.md) § Language.

| ADR | Decision | Status |
|---|---|---|
| [ADR-01](0001-build-on-frigate-rather-than-reimplement-the-video-pipeline.md) | Build on Frigate rather than reimplement the video pipeline | Accepted |
| [ADR-02](0002-primary-language-dotnet-10.md) | Primary language: .NET 10 | Accepted |
| [ADR-03](0003-face-recognition-frigate-chosen-over-a-python-worker.md) | Face recognition: Frigate chosen, a Python worker rejected | Accepted |
| [ADR-04](0004-frigate-to-vyzio-communication-mqtt-and-frigate-rest-api.md) | Frigate to Vyzio communication: MQTT + Frigate REST API | Accepted |
| [ADR-05](0005-vyzio-inter-service-communication-mqtt-and-channels.md) | Vyzio inter-service communication: MQTT + Channels | Accepted |
| [ADR-06](0006-database-sqlite.md) | Database: SQLite | Accepted |
| [ADR-07](0007-api-asp-net-core.md) | API: ASP.NET Core | Accepted |
| [ADR-08](0008-dashboard-react-and-typescript.md) | Dashboard: React + TypeScript | Accepted |
| [ADR-09](0009-notifications-telegram-first-plus-fcm-and-alternative-channels.md) | Notifications: Telegram (primary) + FCM + alternative channels | Accepted |
| [ADR-10](0010-authentication-jwt-and-bcrypt.md) | Authentication: JWT + bcrypt | Accepted |
| [ADR-11](0011-non-technical-ux-strategy-simplified-vyzio-hub-plus-advanced-frigate.md) | Non-technical UX strategy: simplified Vyzio Hub + advanced Frigate | Accepted |
| [ADR-12](0012-camera-management-driven-by-vyzio-applied-to-frigate.md) | Camera management driven by Vyzio, applied to Frigate | Accepted |
| [ADR-13](0013-profile-photos-stored-by-vyzio-synced-through-the-frigate-rest-api.md) | Profile photos: stored by Vyzio, synced through the Frigate REST API | Accepted |
| [ADR-14](0014-per-camera-detection-labels-json-column-on-camera.md) | Per-camera detection labels: a JSON column on Camera | Accepted |
| [ADR-15](0015-profile-camera-association-join-table-and-filtering-in-profilerulesservice.md) | Profile-camera association: a join table + filtering in ProfileRulesService | Accepted |
| [ADR-16](0016-live-stream-access-polling-latest-jpg-through-vyzio-frigate-never-exposed.md) | Live stream access: polling latest.jpg through Vyzio, Frigate never exposed | Accepted |
| [ADR-17](0017-event-clip-access-an-authenticated-streaming-vyzio-proxy.md) | Event clip access: an authenticated streaming Vyzio proxy | Accepted |
| [ADR-18](0018-continuous-recording-enabled-per-camera-in-the-generated-frigate-config.md) | Continuous recording: enabled per camera in the generated Frigate config | Superseded by ADR-39 (retention, activation) |
| [ADR-19](0019-dvrip-xmeye-protocol-go2rtc-as-a-fallback-gateway-transparent-to-frigate.md) | dvrip/XMEye protocol: go2rtc as a fallback gateway, transparent to Frigate | Accepted |
| [ADR-20](0020-privacy-mode-vendor-api-first-frigate-fallback-and-ivendorcameraadapter.md) | Privacy mode: vendor API first, Frigate `enabled: false` fallback, `IVendorCameraAdapter` as the shared building block | Accepted |
| [ADR-21](0021-ptz-parking-and-a-generic-onvif-adapter-a-layered-privacy-mode-strategy.md) | PTZ parking and a generic ONVIF adapter: a layered strategy for privacy mode | Accepted |
| [ADR-22](0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md) | Camera capability catalogue: brand/protocol decoupling, vendor presets and manual onboarding | Accepted |
| [ADR-23](0023-camera-reachability-monitoring-periodic-tcp-polling-independent-of-frigate.md) | Camera reachability monitoring: periodic TCP polling, independent of Frigate | Accepted |
| [ADR-24](0024-protocol-layer-separated-from-capability-layer-onvifclient-supportedprotocol-privacystrategy.md) | Protocol layer separated from capability layer: `OnvifClient`, `SupportedProtocol`, `PrivacyStrategy` | Accepted |
| [ADR-25](0025-ptz-position-management-native-presets-branch-a-vs-vyzio-managed-positions-branch-b.md) | PTZ position management: native presets (Branch A) vs Vyzio-managed positions (Branch B) | Accepted |
| [ADR-26](0026-ptz-position-thumbnails-client-triggered-capture-file-storage-direct-serving.md) | PTZ position thumbnails: client-triggered capture, file storage, direct serving | Accepted |
| [ADR-27](0027-advanced-image-settings-imagesettings-capability-onvif-imaging-service-values-not-persisted.md) | Advanced image settings: the `ImageSettings` capability, ONVIF Imaging Service, values not persisted | Accepted |
| [ADR-28](0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md) | Cascading multi-protocol capability detection + the `ManuallyConfigured` flag | Accepted |
| [ADR-29](0029-dvrip-a-shared-dvripclient-image-settings-and-ptz-move-stop.md) | DVRIP: a shared `DvripClient`, image settings (`AVEnc.VideoColor.[0]`), PTZ Move/Stop | Accepted |
| [ADR-30](0030-native-v380-image-settings-rejected-imagesettings-through-onvif-only.md) | Native V380 image settings rejected, `ImageSettings` through ONVIF only | Accepted |
| [ADR-31](0031-manual-vendor-override-at-onboarding.md) | Manual vendor override at onboarding | Accepted |
| [ADR-32](0032-three-stage-network-discovery-pipeline-identification-enrichment-interpretation.md) | Three-stage network discovery pipeline: identification, enrichment, interpretation | Accepted |
| [ADR-33](0033-detection-engine-status-exposed-on-the-hub.md) | Detection engine status exposed on the Hub: a restart tracker + `/api/system/stats` enrichment | Accepted |
| [ADR-34](0034-automatic-hardware-adaptation-of-the-frigate-detector.md) | Automatic hardware adaptation of the Frigate detector: Coral, then Intel GPU (`onnx` + YOLOX), then CPU (native, capped FPS) | Accepted |
| [ADR-35](0035-self-adjusting-per-camera-detection-sensitivity.md) | Self-adjusting per-camera detection sensitivity: a three-tier closed loop, applied live over MQTT | Accepted |
| [ADR-36](0036-frame-rate-aligned-on-the-camera-the-streamconfig-capability.md) | Frame rate aligned on the camera: the `StreamConfig` capability, conditional on the detect/record split | Accepted |
| [ADR-37](0037-hardware-video-decoding-preset-vaapi-chosen-quicksync-deferred.md) | Hardware video decoding: `preset-vaapi` chosen, QuickSync deferred (no known per-camera codec) | Accepted |
| [ADR-38](0038-camera-stream-model-one-stream-one-quality-separate-detect-and-record-roles.md) | Camera stream model: one stream = one quality, one target = one camera, separate `detect`/`record` roles | Accepted |
| [ADR-39](0039-global-settings-overridable-per-camera-applied-to-recording-retention.md) | Global settings overridable per camera, applied to recording retention | Accepted (the zero-retention and shutdown-on-zero behaviour for event clips was withdrawn by ADR-48) |
| [ADR-40](0040-information-architecture-viewing-apart-from-configuring-two-level-settings-tree.md) | Information architecture: viewing apart from configuring, a two-level settings tree | Accepted |
| [ADR-41](0041-settings-edit-cycle-an-explicit-draft-and-saving-means-applying.md) | Settings edit cycle: an explicit draft, and saving means applying | Accepted (the "saving means applying" part was replaced by ADR-44) |
| [ADR-42](0042-interface-component-foundation-shadcn-ui-on-radix-and-tailwind.md) | Interface component foundation: shadcn/ui on Radix and Tailwind, design system tokens as the single source | Accepted |
| [ADR-43](0043-settings-grammar-a-setting-is-declared-not-drawn.md) | Settings grammar: a setting is declared, it is not drawn | Accepted (the long-help redirect to `docs/user/` was replaced by ADR-53) |
| [ADR-44](0044-surveillance-restart-an-explicit-user-act-grouped-and-deferred.md) | Surveillance restart: an explicit user act, grouped and deferred | Accepted |
| [ADR-45](0045-ptz-positions-configured-from-the-live-view-never-from-settings.md) | PTZ positions configured from the live view, never from settings | Accepted (calibration and the creation gesture were withdrawn by ADR-46) |
| [ADR-46](0046-all-ptz-control-in-the-live-view-calibration-included.md) | All PTZ control in the live view, calibration included | Accepted |
| [ADR-47](0047-detection-history-an-index-reconciled-against-frigate-not-a-standalone-memory.md) | Detection history: an index reconciled against Frigate, not a standalone memory | Superseded by ADR-49 |
| [ADR-48](0048-one-day-minimum-retention-retention-is-tuned-not-turned-off.md) | One-day minimum retention: retention is tuned, not turned off | Accepted |
| [ADR-49](0049-vyzio-does-not-persist-detections-history-is-frigates-list-enriched-on-read.md) | Vyzio does not persist detections: history is Frigate's list, enriched on read | Accepted |
| [ADR-50](0050-the-messaging-channel-becomes-bidirectional-a-channel-agnostic-command-layer.md) | The messaging channel becomes bidirectional: a channel-agnostic command layer | Accepted |
| [ADR-51](0051-remote-access-to-the-interface-netbird-overlay-network-operated-by-the-user.md) | Remote access to the interface: a NetBird overlay network, guided by Vyzio but operated by the user | Accepted |
| [ADR-52](0052-the-inbound-direction-uses-the-channels-native-bot-credentials-declared-per-direction.md) | The inbound direction uses the channel's native bot: credentials declared per direction | Accepted |
| [ADR-53](0053-user-documentation-lives-in-the-interface-three-levels-of-help.md) | User documentation lives in the interface: three levels of help | Accepted |
| [ADR-54](0054-interface-access-guarded-by-an-owner-account-server-session-in-a-cookie.md) | Interface access guarded by an owner account, server session in a cookie | Accepted |
