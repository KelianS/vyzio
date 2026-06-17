# Investigation — V380 Pro : mode vie privée via ONVIF (juin 2026)

> Résultats des tests live sur V380 Pro 192.168.1.135.

## Ports ouverts

- 554 : RTSP (flux local disponible, contrairement à ICSee)
- 8800 : protocole propriétaire binaire (non documenté)
- 8899 : ONVIF

## Capabilities ONVIF

- Media ✅
- PTZ ✅
- Imaging ❌ (contrôle exposition/obturateur absent)

## Commandes testées pour couper le flux

| Commande ONVIF | Résultat | Note |
|---|---|---|
| `GetPrivacyMasks` | "Service has no operation" | Non implémenté dans le WSDL Media |
| `GetPrivacyMaskOptions` | "Service has no operation" | Idem |
| `GetOSDs` | "Method not implemented" | |
| `GetOSDOptions` | "Method not implemented" | |
| `SetVideoEncoderConfiguration` | "Missing element Multicast" | Bug firmware : retourne cette erreur même en renvoyant le payload d'origine sans modification |
| `RemoveVideoEncoderConfiguration` | "Method not implemented" | |
| `GetVideoSourceConfigurations` | ✅ OK | Retourne deux configs : 1920×1080 et 640×480, token `VideoSourceConfiguration0` |

`SetVideoEncoderConfiguration` est inutilisable : le firmware exige un champ `Multicast` mais ne l'accepte pas non plus quand il est fourni — l'implémentation ONVIF du firmware est incomplète.

## PTZ ONVIF

- `ContinuousMove` + `Stop` → **fonctionnels**, mouvement physique confirmé
- `RelativeMove`, `AbsoluteMove`, `GetStatus`, `SetHomePosition`, `GotoHomePosition` → "not implemented"
- `GetPresets` / `GotoPreset` → à re-tester lors de l'implémentation P2 (retournaient "not implemented" lors de cette session)

## PTZ parking — solution retenue (P2)

Séquence privacy ON : `ContinuousMove(pan=-1, tilt=-1)` ~8s → butée mécanique → `Stop`.  
Séquence privacy OFF : `GotoPreset 1` si supporté, sinon `ContinuousMove(pan=+1, tilt=+1)` ~4s (retour approximatif).

La position exacte n'est pas garantie sans `AbsoluteMove` ni preset confirmé — à valider lors de l'implémentation.

## Conclusion

ONVIF est disponible sur V380 Pro mais n'expose aucune API permettant de couper le flux vidéo (privacy masks absents, config encodeur inaccessible). Le PTZ parking via `ContinuousMove` est la **seule solution hardware viable**, comme pour ICSee (protocole différent, même conclusion). Implémentation prévue en 1.0.1-P2 avec UI de configuration (voir backlog).
