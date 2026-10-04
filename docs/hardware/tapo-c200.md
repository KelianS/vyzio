# TP-Link Tapo C200

Raw measurements on a Tapo C200. What a sheet holds: [`../WORKFLOW.md`](../WORKFLOW.md) § Document
architecture.

| Measured | Measurement |
|---|---|
| 2026-09-25 | ONVIF serves every service on one endpoint, `/onvif/service`; the per-service paths answer 404 |
| 2026-09-25 | While privacy mode is on, an ONVIF PTZ command gets a malformed HTTP answer, not a SOAP fault |
| 2026-09-25 | After 10 failed logins, the account cools down for about 25 minutes |
| 2026-09-25 | KLAP takes the Tapo cloud account; RTSP and ONVIF take the camera's local account |
