# TP-Link Tapo C200

Raw measurements on a Tapo C200. What a sheet holds: [`../WORKFLOW.md`](../WORKFLOW.md) § Document
architecture.

| Recorded | Measurement |
|---|---|
| 2026-10-05 | Through go2rtc 1.9.10, `stream1` is H.264 1280 x 720 with G.711 audio, which go2rtc's MSE turns into FLAC; `stream8` is MJPEG 640 x 360, which MSE cannot carry |
| 2026-10-04 | A wrong ONVIF password gets an HTTP 400 `ter:NotAuthorized` fault, not a 401 |
| 2026-10-04 | ONVIF `SetPreset` on a free token stores the preset under that token, and `RemovePreset` removes it |
| 2026-09-25 | ONVIF serves every service on one endpoint, `/onvif/service`; the per-service paths answer 404 |
| 2026-09-25 | While privacy mode is on, an ONVIF PTZ command gets a malformed HTTP answer, not a SOAP fault |
| 2026-09-25 | After 10 failed logins, the account cools down for about 25 minutes |
| 2026-09-25 | KLAP takes the Tapo cloud account; RTSP and ONVIF take the camera's local account |
| 2026-09-02 | `nmap` finds TCP 80 closed and 443 open; `/app/handshake1` on 443 answers `{"error_code":-40210}`, not the binary KLAP handshake of Tapo plugs (#88) |
