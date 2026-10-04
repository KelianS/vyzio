# Vendor catalogue

This folder is the **single source** for everything about supporting a camera brand or model in Vyzio:
- The user documentation the interface shows during discovery
- The capabilities declared for each brand (PTZ, hardware privacy, image settings)
- The official list of recognised hardware

---

## Supported hardware

| Family (`VendorFamily`) | id | Display name | Reachable privacy | PTZ | Image settings |
|---|---|---|---|---|---|
| `TplinkTapo` | `tplink_tapo` | TP-Link Tapo | **PTZ parking**. The hardware cut exists but its protocol is not yet validated on hardware (issue #88) | Yes through ONVIF, checked on a C200 | Brightness, contrast, saturation, sharpness and IR through ONVIF |
| `Icsee` | `icsee` | ICSee / XMEye | **PTZ parking** | Yes, ONVIF tried first, DVRIP fallback (ADR-28) | Brightness, contrast, saturation through DVRIP (ADR-29). Sharpness and IR unavailable |
| `V380Pro` | `v380_pro` | V380 PRO | **PTZ parking** | Yes through V380 | Not confirmed on the tested hardware, configurable by hand |

> **Hardware cut**: Vyzio drives the vendor's local API. The sensor or the physical shutter is turned off, a signal that cannot be faked.
>
> **PTZ parking**: Vyzio physically turns the camera to its saved Parking position and stops recording at the same time; at the end, it brings it back to its Surveillance position (ADR-57). Double protection: the camera sees nothing AND Vyzio records nothing.

The privacy column says what the brand makes **reachable**, not what is applied. The effective
strategy is a per-camera setting (`Camera.PrivacyStrategy`, `SoftwareBlur` by default), never
deduced from the brand: `Hardware` requires a verified `HardwarePrivacy` binding, `PtzParking` a
verified `Ptz` binding.

The `VendorFamily` values in the C# code (enum `Vyzio.Core.Entities.VendorFamily`) are converted to these DB values by `JsonNamingPolicy.SnakeCaseLower`. The `.md` file name must match the DB value.

---

## Capability model (ADR-22, updated by ADR-24)

Each brand is defined as a **capability preset**, not as a monolithic adapter. A capability (e.g. `Ptz`) is independent of the brand: it is resolved by **network protocol** (`SupportedProtocol`: `Onvif`, `V380`, `Dvrip`, `TapoKlap`, `Rtsp`).

<!-- vendor-presets:start -->
```
TplinkTapo → Ptz/[Onvif], ImageSettings/[Onvif], HardwarePrivacy/[TapoKlap]
Icsee → Ptz/[Onvif, Dvrip], ImageSettings/[Dvrip]
V380Pro → Ptz/[V380]
```
<!-- vendor-presets:end -->

> This block is rendered from `VendorCapabilityPresets.All` and checked by
> `VendorCatalogDocumentationTests`. Do not edit it by hand: the test fails and prints the expected
> text, to paste here as is.

Several protocols for one capability form a **cascade**, tried in the written order (ADR-28). The
preset declares what is *expected* for the brand; each capability is then **verified by a probe**
on the real hardware before it can be enabled (a proof read on the camera or, when no reading proves
it, the trial confirmed by the user), and a failed probe does not block the others.

Privacy is no longer a capability, except `HardwarePrivacy`: `PtzParking` relies on the existing
`Ptz` binding. Capabilities deliberately left out of a preset, and why, are commented in
`VendorCapabilityPresets.cs`.

---

## Adding a vendor

### 1. Create the sheet `vendors/<vendorFamily>.md`

The file name must match the DB value of `VendorFamily` (e.g. `tplink_tapo.md`).

The sheet is served as is to the user while adding the camera, so it is written in French, as all
interface text. It says only what cannot be done from Vyzio, in the vendor app, and holds
**exactly** these two sections, on the model of `v380_pro.md`:

```md
# Nom du constructeur

## Avant d'ajouter la caméra

Une phrase de contexte, si elle aide.

1. Ce qu'il faut faire dans l'application du constructeur, étape par étape
2. Revenez ici : Vyzio vous demandera l'identifiant et le mot de passe.

## Si cela ne fonctionne pas

- Quelques conseils courts, propres au constructeur
```

No port, no stream path, no protocol, nothing on how Vyzio works inside, nothing on what it will do later.

Markdown links `[label](url)` are clickable in the UI. Static assets go in `vendors/assets/` and are served at `/api/cameras/vendor-assets/<name>`.

---

### 2. Add the value to the `VendorFamily` enum

In `Vyzio.Core/Entities/VendorFamily.cs`. The member name is PascalCase:
`JsonNamingPolicy.SnakeCaseLower` derives the DB value from it (`MyVendor` → `"my_vendor"`), and the
`.md` file name must match that value.

---

### 3. Register network detection

In `Vyzio.Infrastructure/Services/CameraDiscovery/`:

- `AssistedCameraDiscoveryKnownDevices.cs`: the fingerprint (mDNS name, hostname, MAC OUI) in `DetectVendorFamily`, the display name in `FormatVendorFamily`
- `AssistedCameraDiscoveryIdentifier.cs`: the support level in `DetermineSupportLevel` (`"guided"` or `"basic"`)

---

### 4. Declare the capability preset

In `Vyzio.Core/Entities/VendorCapabilityPresets.cs`, on the model of the existing entries: a
capability, and the ordered list of protocols to try for it.

If the protocol does not exist yet, create the matching provider (`IPtzCapabilityProvider`,
`IPrivacyCapabilityProvider`, `IImageSettingsCapabilityProvider`) in
`Vyzio.Infrastructure/CapabilityProviders/` and register it in
`Vyzio.Infrastructure/DependencyInjection/ServiceCollectionExtensions.cs`. **The DI registration
order is the trial order** in blind detection, ONVIF first (ADR-28).

---

### 5. Update this README

The "Supported hardware" table by hand, the capability block by re-running `dotnet test`: the test
fails and prints the expected block.
