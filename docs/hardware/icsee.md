# ICSee (Xiongmai firmware, DVRIP)

Raw measurements on ICSee units. What a sheet holds: [`../WORKFLOW.md`](../WORKFLOW.md) § Document
architecture.

| Recorded | Measurement |
|---|---|
| 2026-10-05 | Through go2rtc 1.9.10 over DVRIP, the main stream is H.265 Main 2304 x 1296 (level 5.1) and the sub-stream H.265 Main 640 x 360 (level 2.1), both with G.711 A-law audio at 8 kHz; go2rtc's MSE names either H.265 stream `hvc1.1.6.L153.B0` whatever its level |
| 2026-10-04 | A DVRIP login with no valid account is answered (message 1001) `{"Name": "", "Ret": 205, "SessionID": "0x00000000"}`: nothing in it names the vendor or the model |
| 2026-10-04 | A battery unit (firmware `V5.04.C02.000959TC.10000.140835.0000000`), woken through the vendor app, answers on DVRIP only: the ONVIF and RTSP ports stay closed while it is awake |
| 2026-09-27 | `SetPreset` and `GotoPreset` answer `Ret` 100; a recall lands on the same framing every time, and three presets recall distinctly in any order |
| 2026-09-27 | `Uart.PTZPreset.[0]` lists the stored presets as `[{"Id": n}, ...]`; a new preset appears right after `SetPreset`, and `ClearPreset` removes it; with no preset stored, the list may read `null` |
| 2026-09-27 | At least twelve presets are kept at once, on ids up to 255 |
| 2026-09-27 | `Ability.PTZ` and `SystemFunction` answer `Ret` 607 (not supported) |
| 2026-09-27 | The vendor app offers no preset feature |
| 2026-09-27 | Some units serve media profiles over ONVIF with no PTZ configuration on them, while their head turns over DVRIP |
