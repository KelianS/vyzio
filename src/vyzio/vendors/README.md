# Vendor help sheets

This folder holds the **help sheets** the add screen shows for a camera brand: what to prepare in
the vendor app before adding the camera. The vendor is a help hint only
([ADR-71](../../../docs/adr/0071-the-vendor-is-a-help-hint.md)): it selects a sheet, and nothing
else. No detection, capability or camera setting depends on it; every capability is detected and
proven the same way, whatever the brand (ADR-66). What a camera model was measured to do lives in
its sheet under [`docs/hardware/`](../../../docs/hardware/).

---

## Sheets

| Family (`VendorFamily`) | id | Display name |
|---|---|---|
| `TplinkTapo` | `tplink_tapo` | TP-Link Tapo |
| `Icsee` | `icsee` | ICSee / XMEye |
| `V380Pro` | `v380_pro` | V380 PRO |

The `VendorFamily` values in the C# code (enum `Vyzio.Core.Entities.VendorFamily`) give the sheet's
id through `JsonNamingPolicy.SnakeCaseLower`. The `.md` file name must match that id.

---

## Writing a sheet

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

## Adding a vendor

1. Write the sheet `vendors/<id>.md`, as above.
2. Add the value to the `VendorFamily` enum in `Vyzio.Core/Entities/VendorFamily.cs`. The member name
   is PascalCase: `JsonNamingPolicy.SnakeCaseLower` derives the id from it (`MyVendor` →
   `"my_vendor"`).
3. Add its row to the table above.

Discovery names the vendor by itself only on a very strong signal: an answer that only this
vendor's proprietary protocol gives, without an account (ADR-71). Without one, the user picks the
vendor from the list on the add screen. A protocol the vendor speaks is a capability provider, not a
vendor entry: a new one takes its place in the protocol priority of each capability it serves.

---

## Capability presets in the code

<!-- vendor-presets:start -->
```
TplinkTapo → Ptz/[Onvif], ImageSettings/[Onvif], HardwarePrivacy/[TapoKlap]
Icsee → Ptz/[Onvif, Dvrip], ImageSettings/[Dvrip]
V380Pro → Ptz/[V380]
```
<!-- vendor-presets:end -->

Rendered from `VendorCapabilityPresets.All` and checked by `VendorCatalogDocumentationTests`. ADR-71
rules presets out: do not add one.
