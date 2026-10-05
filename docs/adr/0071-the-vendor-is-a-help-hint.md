# ADR-71: The vendor is a help hint

> Status: Accepted
>
> Amends [ADR-12](0012-camera-management-driven-by-vyzio-applied-to-frigate.md) (no multicast, no
> MAC, no "camera supported" state),
> [ADR-22](0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md)
> (no vendor preset, no vendor on the camera),
> [ADR-24](0024-protocol-layer-separated-from-capability-layer-onvifclient-supportedprotocol-privacystrategy.md)
> (the V380 device number asked of the camera only, never broadcast),
> [ADR-28](0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md)
> (one priority order per capability instead of a preset),
> [ADR-32](0032-three-stage-network-discovery-pipeline-identification-enrichment-interpretation.md)
> (the vendor from a proprietary answer only; no MAC, no multicast, no KLAP fingerprint; the
> dashboard's /24 swept),
> [ADR-66](0066-a-capability-is-proven-by-a-read-or-confirmed-by-the-user-after-a-try.md) e) (a
> capability to confirm is kept on every camera) and
> [ADR-68](0068-a-camera-is-created-from-its-access-alone.md) e) (a vendor chosen on the add screen,
> for its help sheet only).

## Context

The vendor of a camera grew several jobs (#274): discovery guesses it from MAC prefixes, open
ports, hostnames and web pages; a vendor preset lists the protocols to try per capability; detection
has a preset path beside the blind one; and the add screen shows the vendor's help sheet.

- Most guesses are weak: a shared protocol such as DVRIP does not make a camera an ICSee, and a MAC
  prefix often names the Wi-Fi module's maker.
- MAC reading and WS-Discovery multicast give nothing from the Compose bridge the stack runs on, and
  host networking is not taken (#251).
- Nothing records a vendor during detection, so no preset applies to a new camera, and a camera
  detected blind drops a capability it can only have confirmed.
- The handshake fingerprinted for Tapo is the one of Tapo plugs and bulbs, not of its cameras (#88).
- The order in which protocols are tried matters whatever the vendor: on the V380, ONVIF PTZ is
  proven by a read, yet every move freezes the firmware for 1 to 3 seconds and cannot be stopped
  ([hardware sheet](../hardware/v380-pro.md)), where its proprietary protocol moves precisely.

## Options compared

| Option | Description | For | Against |
|---|---|---|---|
| **A. Keep the vendor and its presets, fix the guesses** | Wire the proprietary answers to the vendor, keep presets and both detection paths | Presets keep the protocol order per vendor | Two detection paths to keep in step; a missed vendor still loses a capability; the guesses stay brittle |
| **B. The vendor as a help hint only** | The vendor chooses a help sheet; detection is one path with a protocol order per capability | One detection for every camera; nothing depends on a guess | The user picks the vendor when no strong signal names it, to read its sheet |

**Option B chosen.**

## Decision

**a) The vendor only selects a help sheet.** No capability preset, no "officially supported" level,
no detection decision depends on it, and the camera does not store it.

**b) One detection path, a protocol priority per capability.** For each capability the candidate
protocols are tried in one fixed order, the same for every camera, proprietary protocols first: a
protocol made for one hardware drives it, where a generic one may answer reads without acting. The
first proof wins within that order (ADR-66). The user still chooses by hand the protocol of each
capability, and detection never overrides that choice (ADR-28).

**c) A capability its protocol answered for stays to confirm.** When a candidate protocol answered
with the account and no read can prove the capability, detection keeps it as a card to confirm,
on every camera, instead of dropping it. A camera without the hardware is answered "no" once
(ADR-66 c).

**d) The vendor is set automatically on a very strong signal only**: an answer that only this
vendor's proprietary protocol gives, without an account, such as the V380 one. A shared protocol, an
open port, a hostname or a web page never names the vendor; hostnames and page titles still feed the
displayed name and the "probably a camera" ranking. Otherwise the user picks the vendor, only to read
its sheet; the choice is not stored. Where and when the list shows: [SPECS](../SPECS.md) 2.2.

**e) Discovery reads no MAC and sends no multicast.** No neighbour table, no MAC prefix table, no
WS-Discovery multicast. It sweeps by unicast, from the bridge, the configured default ranges plus the
/24 of the address the dashboard was opened by, only when that address is a private IPv4 one. What
the discovery screen shows of the ranges: [SPECS](../SPECS.md) 2.2.

**f) No fingerprint for a protocol the cameras do not speak**: the Tapo plug handshake goes.

**g) The V380 device number is asked of the camera's own address only**, never by broadcast: in a
home with two V380 cameras, a broadcast may return the other camera's number. Typing it stays the
last resort.

## Options rejected

**Vendor presets with a preset path in detection (A).** They steer detection on a guess, keep two
paths, and apply to no new camera today. The order they carried is a property of the protocols, so
it moves to the capability.

**Host networking for discovery.** It would bring back the MAC and multicast signals, but puts the
API on the host's network and the dashboard with it (#251); a wider unicast sweep finds the same
cameras.

**A vendor from an open port, a MAC prefix or a hostname.** Each points at a module maker or at a
protocol several makers share, so the sheet shown would be wrong as often as right.

**Storing the vendor chosen on the add screen.** Nothing reads it once the camera is added.

## Consequences

- ✅ Every camera goes through the same detection; a capability no longer depends on a vendor
  being recognised
- ✅ A V380 head, a Tapo camera or an ICSee that keeps no preset gets its card to confirm without
  being added by hand
- ✅ Discovery works the same from the bridge as anywhere: no signal that the topology hides
- ⚠️ A camera outside the swept ranges is added by typing its address
- ⚠️ Without a strong signal, the user picks the vendor to read its sheet
- ⚠️ A camera answering a protocol but lacking the hardware shows a card to confirm until the user
  answers "no"
