# V380 Pro

Raw measurements on a V380 Pro. What a sheet holds: [`../WORKFLOW.md`](../WORKFLOW.md) § Document
architecture.

| Recorded | Measurement |
|---|---|
| 2026-10-04 | ONVIF answers `GetDeviceInformation` to a wrong password exactly as to the right one |
| 2026-10-04 | RTSP serves the stream description without asking for an account |
| 2026-10-04 | The ONVIF PTZ service answers `GetConfigurationOptions` but faults `GetPresets` and `GetStatus` as not implemented; no Imaging service is announced |
| 2026-06-28 | An ONVIF PTZ command is answered 2 to 3 seconds after it is sent, the camera moving on receipt |
| 2026-05-14 | The answer to the V380 authentication frame carries no documented signature to recognise the protocol by |
