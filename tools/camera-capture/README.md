# Camera capture

Records what a real camera answers, protocol by protocol, as the contract fixtures under
[`src/vyzio/Vyzio.Tests/Contracts/Fixtures/`](../../src/vyzio/Vyzio.Tests/Contracts/Fixtures/)
(#92). Each run writes one folder per protocol, `<protocol>/<model>-<firmware>/`, holding one
ordered transcript per scenario and a `manifest.json` (model, firmware, date, command, commit).

Python 3.12 with `pycryptodome` (`pip install pycryptodome`, already needed by `tools/camera-probe`).

## What a transcript holds

Messages in the order they crossed the wire, each tagged `request`/`response` (HTTP) or
`sent`/`received` (TCP, UDP). SOAP, RTSP and JSON are text; V380 frames are `hex`; a DVRIP frame
is its `header` in hex plus its JSON `body`. A camera that stays silent, hangs up or
answers garbage is recorded too, as an `event`. Scenarios flagged `writes` stored something on the
camera and removed it in the same transcript.

## Privacy

- The account comes from the environment or from `--env-file`, a `KEY=VALUE` file **outside the
  repository**: `VYZIO_CAPTURE_HOST`, `VYZIO_CAPTURE_USERNAME`, `VYZIO_CAPTURE_PASSWORD`, and
  optionally `VYZIO_CAPTURE_V380_DEVICE_ID`. The tool never prints them.
- Requests are recorded as if sent with the fixture account of
  [`neutral-values.json`](../../src/vyzio/Vyzio.Tests/Contracts/Fixtures/neutral-values.json):
  the WS-Security digest, the DVRIP Sofia hash, the V380 encrypted password and the RTSP Digest
  response are computed again from it, with the nonce of the real exchange, so a replay matches.
- Serials, hostnames, MAC addresses, private IPv4 and IPv6 addresses, UUIDs, DVRIP session ids and admin tokens,
  the V380 device number and ticket are replaced by the stable values of the same file, in text and in
  binary frames alike.
- No video is ever recorded: RTSP stops at `DESCRIBE`, V380 at the authentication frame.

## Capturing a new model or firmware

1. Pick the model slug of its sheet in [`docs/hardware/`](../../docs/hardware/), or add the
   sheet first.
2. Run read-only, with the protocols the camera speaks:

   ```
   python tools/camera-capture/capture.py --model icsee --protocols onvif,dvrip,rtsp --env-file ../camera.env
   ```

   ONVIF always runs: it names the firmware and gives RTSP its stream address. DVRIP names the
   firmware when ONVIF does not; when neither can, pass `--firmware`.
3. Add `--allow-writes` to also record the preset scenarios: a preset stored where the head already
   points, listed, then removed. Nothing moves the head, and privacy mode is never touched.
4. Check what the run printed: a protocol that failed is named, and a preset left behind is said.
5. Review the diff of the fixtures, then run the backend tests: `FixtureHygieneTests` fails on any
   private address, MAC address or credential that is not the fixture account. The contract tests
   of a replayed protocol fail until the new folder has its row of expected values in them.

A firmware not seen before lands in a new folder on its own; an older one stays as it is.
