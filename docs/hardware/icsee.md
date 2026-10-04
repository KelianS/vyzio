# ICSee (Xiongmai firmware, DVRIP)

Raw measurements on ICSee units. What a sheet holds: [`../WORKFLOW.md`](../WORKFLOW.md) § Document
architecture.

| Measured | Measurement |
|---|---|
| 2026-09-27 | `SetPreset` and `GotoPreset` answer `Ret` 100; a recall lands on the same framing every time, and three presets recall distinctly in any order |
| 2026-09-27 | `Uart.PTZPreset.[0]` lists the stored presets as `[{"Id": n}, ...]`; a new preset appears right after `SetPreset`, and `ClearPreset` removes it; with no preset stored, the list may read `null` |
| 2026-09-27 | At least twelve presets are kept at once, on ids up to 255 |
| 2026-09-27 | `Ability.PTZ` and `SystemFunction` answer `Ret` 607 (not supported) |
| 2026-09-27 | The vendor app offers no preset feature |
| 2026-09-27 | Some units serve media profiles over ONVIF with no PTZ configuration on them, while their head turns over DVRIP |
