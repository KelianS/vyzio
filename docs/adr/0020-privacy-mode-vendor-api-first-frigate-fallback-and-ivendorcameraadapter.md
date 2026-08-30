# ADR-20 — Privacy Mode : API constructeur en premier, fallback Frigate `enabled: false` + `IVendorCameraAdapter` comme brique partagee

> Statut : Accepté

## Contexte

Le mode vie privee (SPECS §9) exige qu'une camera soit **reellement coupee** : aucun flux RTSP diffuse par la camera, aucun enregistrement, aucune detection. La contrainte cle est que le flux RTSP ne soit accessible par personne sur le reseau local — y compris Frigate, y compris un tiers qui connaitrait l'IP de la camera.

Une solution qui ne desactive que le pipeline Frigate ne repond pas a cette exigence : la camera continue de diffuser, et quiconque sur le LAN connait son IP peut s'y connecter directement.

Deux besoins doivent etre couverts simultanement :

- activation manuelle instantanee ("couper maintenant") et bascule multiple simultanee ;
- planification recurrente (jours de la semaine + plage horaire, ex. tous les soirs 22h–6h).

**Note strategique :** l'interface avec le firmware de la camera est une brique qui sera reutilisee plus tard pour les infos systeme (batterie, temperature, etat connexion) et le PTZ (ADR futur). L'ADR-20 introduit l'abstraction `IVendorCameraAdapter` qui servira pour ces features ulterieures.

## Analyse des mecanismes de coupure reelle

Le probleme fondamental est reseau : si une camera WiFi et un autre appareil sont tous les deux sur le meme routeur domestique, Vyzio ne peut pas intercepter leur trafic — `iptables` sur l'hote Docker ne bloque que les flux passant par cet hote, pas le trafic lateral sur le LAN. La seule facon de garantir la coupure est d'intervenir **a la source** (firmware de la camera) ou **sur l'alimentation** (PoE / smart plug).

| Mecanisme | Universalite | Dependance infra | Verdict |
|---|---|---|---|
| **API constructeur** (firmware REST/DVRIP) | Partiel, par marque | Aucune | ✅ Retenu en premier |
| **PoE port disable** (switch SNMP/REST) | Cameras filaires uniquement | Switch manage requis | ❌ Hors perimetre (futur optionnel) |
| **Smart plug** (Tasmota, Shelly, Tuya) | AC seulement | Smart plug compatible | ❌ Hors perimetre (futur optionnel) |
| **iptables sur hote Docker** | Seulement si Vyzio = gateway reseau | `NET_ADMIN` + routing | ❌ Non universel domestique |
| **`enabled: false` Frigate seul** | Universel | Aucune | ✅ Fallback obligatoire |

**Constat d'honnêteté produit :** pour les cameras dont le firmware ne supporte pas de commande de coupure, le fallback `enabled: false` dans Frigate est la seule option sans infra supplementaire. L'UI doit distinguer ces deux etats et informer l'utilisateur sur le niveau de garantie reel.

## Decision

**Approche en deux couches, toujours cumulatives :**

1. **Couche 1 — API constructeur (si supportee)** : envoyer une commande au firmware de la camera pour desactiver la capture video ou le streaming. La camera cesse physiquement de diffuser.
2. **Couche 2 — Frigate `enabled: false` (toujours)** : quel que soit le resultat de la couche 1, regenerer `frigate.yml` avec `enabled: false` et recharger Frigate. Cette couche est systematique et ne depend pas du succes de la couche 1.

L'UI indique a l'utilisateur si la couche 1 a reussi ("camera eteinte") ou si seul le fallback Frigate est actif ("flux RTSP non accessible depuis Vyzio, mais potentiellement visible sur le LAN si votre camera ne supporte pas la coupure distante").

## API constructeur — perimetre initial

Les marques suivantes sont retenues pour la v1 de l'adaptateur, par ordre de volume de marche grand public :

| Marque / Famille | Mecanisme de coupure | Endpoint / Commande | Signal physique verifiable |
|---|---|---|---|
| **TP-Link Tapo** | API locale KLAP (protocole documente par la communaute) | `set_lens_mask` (active le cache physique + eteint le voyant LED) | ✅ Voyant LED eteint = camera vraiment inactive |
| **Reolink** | REST API officielle | `POST /api.cgi?cmd=SetChannelStatus` `{ channel: 0, status: 0 }` | ⚠️ Selon modele |
| **Hikvision** | ISAPI REST | `PUT /ISAPI/System/Video/inputs/channels/1` `<enabled>false</enabled>` | ⚠️ Selon modele |
| **Dahua** | CGI REST | `GET /cgi-bin/configManager.cgi?action=setConfig&VideoOut[0].Enable=false` | ⚠️ Selon modele |
| **ICSee / XMEye / Xiongmai** | DVRIP (protocole deja utilise en ADR-19) | Commande `MSG_VIDEO_COMMAND` sur port 34567 | ⚠️ Selon modele |

**Note sur le protocole Tapo :** TP-Link Tapo utilise un protocole de chiffrement local nomme **KLAP** (Key-based Local Authentication Protocol) documente par la communaute (reverse-engineering). La commande `set_lens_mask` active le cache physique de l'objectif et eteint le voyant LED — ce sont des signaux physiques directement observables qui confirment que la camera ne capture plus. L'implementation requiert un handshake d'authentification locale (seed + HMAC-SHA256) independant du cloud TP-Link — coherent avec la philosophie local-first de Vyzio.

Les cameras pour lesquelles aucun adaptateur n'est disponible recoivent le `NullVendorAdapter` — fallback Frigate uniquement, avec indication UI.

## `IVendorCameraAdapter` — interface partagee (brique reutilisable)

```csharp
// Core/Interfaces/IVendorCameraAdapter.cs
public interface IVendorCameraAdapter
{
    string VendorFamily { get; }  // "reolink" | "hikvision" | "dahua" | "icsee" | "generic"

    // Privacy Mode (ADR-20)
    Task<bool> SupportsPrivacyModeAsync(CancellationToken ct);
    Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct);

    // System Info — a implementer dans l'ADR futur PTZ/System info
    Task<bool> SupportsSystemInfoAsync(CancellationToken ct);
    // Task<CameraSystemInfo> GetSystemInfoAsync(Camera camera, CancellationToken ct);
}
```

La resolution de l'adaptateur se fait via un `IVendorCameraAdapterFactory` qui selectionne l'implementation selon `camera.VendorFamily` (champ deja present sur l'entite `Camera`).

## Modele de donnees — extensions

```sql
ALTER TABLE cameras ADD COLUMN privacy_mode_active   INTEGER NOT NULL DEFAULT 0;
-- "manual" = active manuellement ; "schedule" = active par planification ; null = off
ALTER TABLE cameras ADD COLUMN privacy_mode_source   TEXT;
-- indique si la couche 1 (API constructeur) a reussi lors de la derniere bascule
ALTER TABLE cameras ADD COLUMN privacy_vendor_cut    INTEGER NOT NULL DEFAULT 0;

CREATE TABLE camera_privacy_schedules (
    id           TEXT PRIMARY KEY,
    camera_id    TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    enabled      INTEGER NOT NULL DEFAULT 1,
    days_of_week TEXT NOT NULL,   -- JSON array [0..6], 0 = dimanche
    start_time   TEXT NOT NULL,   -- "HH:mm"
    end_time     TEXT NOT NULL,   -- "HH:mm" ; passage minuit = deux plages
    created_at   TEXT NOT NULL
);
CREATE INDEX idx_privacy_schedules_camera ON camera_privacy_schedules(camera_id, enabled);
```

## Regles de priorite manuel / schedule

- `privacy_mode_source = "manual"` : la planification ne peut pas desactiver automatiquement ; seul un toggle manuel repasse la source a `null` et rend le controle au scheduler.
- `privacy_mode_source = "schedule"` : le scheduler desactive a la fin de la fenetre.
- Quand l'utilisateur reactive manuellement pendant une fenetre planifiee, la source repasse a `null` (suivi de planification repris).

## Flux d'activation

```
ToggleCameraPrivacyModeUseCase.ExecuteAsync(cameraId, active: true)
  1. Mettre a jour camera.privacy_mode_active = true, source = "manual"
  2. Resoudre IVendorCameraAdapter via IVendorCameraAdapterFactory
  3. Si SupportsPrivacyModeAsync() → appeler SetPrivacyModeAsync(camera, true)
       → succes : camera.privacy_vendor_cut = true
       → echec / non supporte : camera.privacy_vendor_cut = false (loggue)
  4. Toujours : regenerer frigate.yml avec enabled: false pour cette camera
  5. Toujours : declencher reload Frigate
```

`BatchToggleCameraPrivacyModeUseCase` execute les etapes 1–3 pour chaque camera de la liste, puis un seul reload Frigate couvrant l'ensemble.

## `PrivacySchedulerService`

```csharp
public class PrivacySchedulerService : BackgroundService
{
    // Evalue toutes les minutes les planifications actives
    // Pour chaque camera : determine si l'heure courante est dans une fenetre planifiee
    // Si entree dans fenetre ET source != "manual" : appelle ToggleCameraPrivacyModeUseCase(active: true, source: "schedule")
    // Si sortie de fenetre ET source == "schedule" : appelle ToggleCameraPrivacyModeUseCase(active: false)
}
```

## Endpoints API

```
POST   /api/cameras/{id}/privacy/toggle              → bascule manuelle unitaire
POST   /api/cameras/privacy/batch-toggle             → bascule simultanee ; body: { cameraIds: [...], active: bool }
GET    /api/cameras/{id}/privacy/schedules
POST   /api/cameras/{id}/privacy/schedules
PATCH  /api/cameras/{id}/privacy/schedules/{sid}
DELETE /api/cameras/{id}/privacy/schedules/{sid}
```

La reponse de `/api/cameras` est etendue avec `privacyModeActive`, `privacyModeSource` et `privacyVendorCut` pour que l'UI puisse afficher le bon niveau de garantie.

## Consequences

- ✅ Coupure reelle cote camera pour les marques supportees (Reolink, Hikvision, Dahua, ICSee)
- ✅ Fallback universel via Frigate `enabled: false` — aucune camera n'est laissee sans protection Vyzio
- ✅ `IVendorCameraAdapter` est la brique pour le PTZ et les infos systeme (ADR futur)
- ✅ `VendorFamily` est deja sur l'entite `Camera` — pas de nouveau champ pour la selection d'adaptateur
- ✅ Batch toggle avec un seul reload Frigate
- ⚠️ Reload Frigate : breve coupure (~1–3s) sur toutes les cameras — l'UI indique que l'operation est en cours
- ⚠️ Cameras sans adaptateur vendor : l'UI indique explicitement que la coupure est Frigate uniquement (flux RTSP brut potentiellement accessible si quelqu'un connait l'IP)
- ⚠️ Passage minuit pour les planifications : a trancher en implementation (deux plages ou detection depassement dans le scheduler)
- ⚠️ Les credentials cameras (ADR-12) sont deja protegees via `DataProtection` — l'adaptateur vendor les consomme via le meme mecanisme
