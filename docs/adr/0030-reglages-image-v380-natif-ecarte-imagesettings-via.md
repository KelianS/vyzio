# ADR-30 — Réglages image V380 natif : écarté, `ImageSettings` via ONVIF uniquement

> Statut : Accepté

## Contexte

`ImageSettings/Onvif` est confirmé cassé sur V380 Pro (ADR-29d). Piste explorée : [`prsyahmi/v380`](https://github.com/prsyahmi/v380) (`v380.cpp`), déjà à l'origine du PTZ natif (ADR-22), contient une commande « lumière » IR (opcode `0xC4`, 16 octets, valeurs on/off/auto). Recherche systématique de tout ce que le protocole expose par ailleurs (pas de devinette) : tous les fichiers du dépôt inspectés, plus les autres sources V380 déjà rassemblées (structure d'authentification, handshake du relais P2P) — aucune commande Brightness/Contrast/Saturation/Sharpness n'existe nulle part ; la vision nocturne était la seule piste restante.

Implémentée (provider + cache de dernière valeur écrite, car le protocole n'a aucune lecture d'état — même limite que le PTZ V380 sans retour de position, ADR-25 Branch B) puis **testée par l'utilisateur en conditions réelles : aucun effet sur la caméra**, malgré un pipeline d'envoi identique à celui du PTZ (confirmé fonctionnel).

Avant de conclure à une limitation matérielle, vérification de la solidité de la source elle-même :
- Le `README.md` du dépôt ne documente **pas** le flag `--light` dans son aide (`-u`, `-p`, `-addr`, `-mac`, `-id`, `-port`, `-retry`, `--enable-ptz`, `--discover` seulement) — signe d'une fonctionnalité jamais vraiment finalisée/documentée par l'auteur.
- Le même dépôt contient une **seconde implémentation indépendante** du protocole (`v380-nodejs/`) qui, elle, **n'a aucune commande lumière du tout** — alors que le PTZ, lui, est bien présent dans les deux implémentations.
- **L'application officielle V380 elle-même n'a pas ce réglage** dans son UI — confirmé par l'utilisateur. Il n'existe donc aucun moyen de capturer le vrai trafic de référence pour comparer (contrairement à DVRIP, où `python-dvr` a servi de vérité terrain, ADR-29).

Conclusion : la commande `0xC4` est la partie la moins fiable de tout ce dépôt — probablement jamais validée par son propre auteur — et rien ne permet de la corriger par déduction supplémentaire.

## Décision

**Retrait complet.** `V380ImageSettingsProvider`, `V380ImageSettingsTracker` et leurs tests ont été supprimés ; `VendorCapabilityPresets.V380Pro` ne déclare plus de binding `ImageSettings` par défaut (retour à l'état ADR-29d — `ImageSettings` reste configurable à la main via ONVIF pour une unité qui répondrait différemment, jamais activée sans test réussi). Le frontend ne propose plus `v380` dans les protocoles de réglages image.

Seule extraction conservée : **`V380DeviceIdBootstrap`** (`Vyzio.Infrastructure/VendorAdapters/`) — la logique de résolution du device ID (ConfigJson persisté → ONVIF serial → repli UDP) a été sortie de `V380PtzProvider` vers une classe statique partagée en prévision de ce provider. Gardée malgré le retrait : c'est une déduplication propre et sans risque, immédiatement réutilisable si une vraie commande de réglages image V380 natif est un jour confirmée.

## Conséquences

- ✅ Aucun contrôle affiché qui ne fait rien réellement (principe ADR-22) — mieux vaut l'absence de la fonctionnalité qu'un faux contrôle
- ✅ `V380DeviceIdBootstrap` reste comme base réutilisable si une source fiable apparaît un jour
- ⚠️ Vision nocturne V380 natif reste hors périmètre tant qu'aucune capture réseau réelle (app tierce compatible, ou reverse engineering matériel) ne fournit une commande confirmée — pas une simple relecture de code existant
- ⚠️ V380 Pro n'a donc aucun contrôle image fonctionnel connu à ce jour (ONVIF cassé, natif inexistant) — à documenter côté utilisateur (`docs/user/`) si la question revient
