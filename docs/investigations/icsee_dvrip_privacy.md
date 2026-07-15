# Investigation — ICSee / XMEye : mode vie privée via DVRIP (juin 2026)

> Résultats des tests live menés sur une caméra ICSee 192.168.1.193, firmware Xiongmai/Sofia.

> ⚠️ **Erratum (2026-07-15)** — la réimplémentation .NET de ce protocole (`DvripClient`, SAD ADR-29) a
> révélé que plusieurs valeurs transcrites ci-dessous étaient fausses par rapport à la vraie
> bibliothèque de référence `python-dvr` (vérifié en lisant son code source puis en testant en
> direct contre cette même caméra) :
> - Le header binaire fait **20 octets**, pas 22 (`cmd`/`dataLen` à des offsets différents).
> - `ConfigSet` est le code **1040**, pas 1044 (1044 est une variante de `ConfigGet` — « config par défaut usine »).
> - Le login attend le champ JSON `"UserName"`, pas `"Name"`.
> - `sofia_hash` apparie des **paires d'octets bruts** du digest MD5 (8 caractères en sortie), pas des paires de nibbles hexadécimaux (16 caractères) — `sofia_hash("a4m3h5") == "S8jyn9CB"`, pas `"6DDKEOQCGQGGILIK"`.
> - Le payload `OPPTZControl` de la section PTZ ci-dessous inclut un champ `"Action"` et un objet `"POINT"` qui **n'existent pas** dans `DVRIPCam.ptz()` (la vraie méthode n'a ni l'un ni l'autre, et `"Pattern"` vaut `"Start"`, pas `"SetBegin"`).
> - **Le vrai mécanisme d'arrêt PTZ** (trouvé via l'intégration Home Assistant [`dbuezas/icsee-ptz`](https://github.com/dbuezas/icsee-ptz), pas dans ce document ni dans `python-dvr` seul) : `ptz("DirectionUp", preset=-1)` — `Preset=-1` est le sentinel d'arrêt, `Command` reste toujours `"DirectionUp"` peu importe la direction en cours. Un mouvement normal utilise `Preset=0`. Voir SAD ADR-29 pour le détail complet.
>
> Les **résultats de test** ci-dessous (Ret 100/606 etc.) restent probablement fiables — ils ont
> vraisemblablement été obtenus via la vraie bibliothèque `python-dvr`, qui utilise en interne les
> bonnes valeurs. Seule leur **transcription** dans ce document (header 22 octets, code 1044) était
> erronée, et a été recopiée telle quelle dans le premier portage .NET — qui n'a donc jamais
> fonctionné en conditions réelles jusqu'à ce correctif.

## Architecture streaming

La caméra se connecte en sortant vers les serveurs **XMEye P2P cloud**. L'application ICSee route la vidéo via ce relais. Les modifications de configuration DVRIP locales n'affectent **pas** le flux cloud — c'est le blocage fondamental.

Ports ouverts sur les modèles cloud-only batterie : **34567 uniquement** (DVRIP). RTSP (554), HTTP (80) et ONVIF (8899) fermés.

## Protocole DVRIP

Header 22 octets : `FF 01 00 00 | sessionId(4 LE) | seqNo(4 LE) | 00 00 00 00 | cmdCode(2 LE) | dataLen(4 LE)`. Payload JSON terminé par `\n\0`.

Codes de commande pertinents (source : python-dvr) :
- Login : 1000
- ConfigGet : 1042
- ConfigSet : 1044
- OPPTZControl : 1400
- OPMonitor Claim : 1413
- OPMonitor Start : 1410
- OPMachine : 1450

Codes de retour : 100=OK, 102=format invalide, 103=non implémenté, 606=écriture bloquée par firmware.

**Sofia hash (mot de passe DVRIP) :** paires de nibbles MD5 sommées mod 62, mappées sur `[0-9A-Za-z]`. Exemple validé : `sofia_hash("a4m3h5") == "6DDKEOQCGQGGILIK"`.

**Compte :** le compte fourni par l'app ICSee (`ubas`) est dans le groupe `admin` avec toutes les autorités.

## Commandes testées pour couper le flux

| Commande | Code | Résultat | Note |
|---|---|---|---|
| `Simplify.Encode.VideoEnable=False` | ConfigSet 1044 | Ret 606 | Firmware bloque explicitement |
| `AVEnc.Encode.[0].VideoEnable=False` | ConfigSet 1044 | Ret 606 | Même blocage |
| `PrivacyMask` full-frame (8192×8192) | ConfigSet 1044 | Ret 100 | Sans effet sur flux cloud |
| `AVEnc.VideoColor.[0].Brightness=1` | ConfigSet 1044 | Ret 100 | Sans effet sur flux cloud |
| `AVEnc.VideoColor.[0].Contrast=0` | ConfigSet 1044 | Ret 606 | Valeur minimale bloquée |
| `Camera.ParamEx.[0].ExposureTime=0x0` | ConfigSet 1044 | Ret 100 | Sans effet sur flux cloud |
| `NetWork.NetCommon.MaxBps=1` | ConfigSet 1044 | Ret 606 | Bloqué |
| `OPMachine Sleep/Standby` | OPMachine 1450 | Ret 103 | Non implémenté dans ce firmware |
| `OPMachine Reboot` | OPMachine 1450 | Ret 100 | Redémarre la caméra |
| `OPMonitor Claim` (avec `CombinMode: "NONE"`) | cmd 1413 | Ret 100 | N'affecte pas le flux cloud |
| **OPPTZControl DirectionLeftUp** | cmd 1400 | **Ret 100** | **PTZ confirmé fonctionnel** |
| **OPPTZControl SetPreset/GotoPreset** | cmd 1400 | **Ret 100** | **Presets confirmés** |

## PTZ parking — solution retenue (P2)

Format JSON OPPTZControl (cmd 1400) :
```json
{
  "Name": "OPPTZControl",
  "SessionID": "0x00000001",
  "OPPTZControl": {
    "Action": "Start",
    "Command": "DirectionLeftUp",
    "Parameter": {
      "AUX": {"Number": 0, "Status": "On"},
      "Channel": 0,
      "MenuOpts": "Enter",
      "POINT": {"bottom": 0, "left": 0, "right": 0, "top": 0},
      "Pattern": "SetBegin",
      "Preset": 65535,
      "Step": 8,
      "Tour": 0
    }
  }
}
```

Séquence privacy ON : `SetPreset 1` (sauvegarder position surveillance) → `DirectionLeftUp` 8s → `Stop`.  
Séquence privacy OFF : `GotoPreset 1`.

## Conclusion

Aucune commande DVRIP locale ne coupe le flux cloud XMEye. Le PTZ parking est la **seule solution hardware viable** sur les caméras ICSee PTZ. Implémentation prévue en 1.0.1-P2 avec UI de configuration (voir backlog).
