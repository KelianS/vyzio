# V380 Pro

Raw measurements on a V380 Pro. What a sheet holds: [`../WORKFLOW.md`](../WORKFLOW.md) § Document
architecture.

| Recorded | Measurement |
|---|---|
| 2026-10-05 | An ONVIF PTZ move turns the camera for 1 to 3 seconds and cannot be stopped: the firmware answers nothing during that time (stop and other commands tried), so ONVIF PTZ is unusable for precise control; a firmware defect, reported by the owner |
| 2026-10-04 | On port 8800, the authentication frame (command 1167) sent with no account and device number 0 is answered by a 256-byte frame of command 1168, a signature the 2026-05-14 row did not find |
| 2026-10-04 | ONVIF answers `GetDeviceInformation` to a wrong password exactly as to the right one |
| 2026-10-04 | RTSP serves the stream description without asking for an account |
| 2026-10-04 | The ONVIF PTZ service answers `GetConfigurationOptions` but faults `GetPresets` and `GetStatus` as not implemented; no Imaging service is announced |
| 2026-06-28 | An ONVIF PTZ command is answered 2 to 3 seconds after it is sent, the camera moving on receipt |
| 2026-05-14 | The answer to the V380 authentication frame carries no documented signature to recognise the protocol by |
