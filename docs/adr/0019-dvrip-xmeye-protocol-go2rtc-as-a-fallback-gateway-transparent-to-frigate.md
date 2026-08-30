# ADR-19 — Protocole dvrip/XMEye : go2rtc comme passerelle de fallback, transparent pour Frigate

> Statut : Accepté

## Contexte

Un ensemble de cameras grand public tournant sur firmware **Xiongmai** (ICSee, XMEye, Annke, Sannce, Zosi, Floureon, ieGeek et tout autre OEM) communique via un protocole binaire proprietaire, **DVRIP/XMEye**, sur le port TCP 34567. Ces cameras peuvent ou non exposer du RTSP — les modeles sur batterie en particulier desactivent souvent RTSP ou ne l'exposent pas du tout.

**Le chemin principal reste toujours RTSP.** go2rtc/dvrip est un **mode de fallback** propose uniquement quand RTSP n'est pas disponible et que le port 34567 repond au magic byte 0xFF du protocole DVRIP. Ce mode est generaliste : il s'applique a toute camera repondant sur ce port, independamment de la marque.

go2rtc est **deja embarque dans Frigate** (depuis v0.12). Il supporte le protocole `dvrip://` et peut retranscrire le flux en RTSP interne sur `127.0.0.1:8554`. Frigate peut donc consommer ce flux go2rtc exactement comme n'importe quelle camera RTSP.

## Options comparées

| Option | Description | Avantages | Inconvenients | Verdict |
|---|---|---|---|---|
| **A — RTSP direct (chemin principal)** | La camera expose RTSP nativement | Simple, universel, aucun intermediaire | Non disponible sur les modeles batterie cloud-only | ✅ Toujours prefere quand disponible |
| **B — go2rtc dvrip (fallback, retenu)** | go2rtc connecte via dvrip:// et expose en RTSP interne | Deja embarque dans Frigate, aucun conteneur supplementaire, transparent pour Frigate | go2rtc doit etre configure dans le YAML Frigate ; camera doit etre eveilllee au demarrage | ✅ Retenu comme fallback |
| **C — Conteneur proxy dedie** | Sidecar Python/Go qui transcrit dvrip en RTSP | Isolation maximale | Complexite deploiement, surface d'attaque supplementaire | ❌ Sur-ingenierie |

## Décision

**Le mode dvrip est un fallback propose par Vyzio uniquement quand RTSP n'est pas disponible et que le port 34567 repond au magic byte DVRIP.** Il est generaliste (toute marque sur firmware Xiongmai) et independant de la famille de constructeur detectee.

Pour les cameras avec `StreamProtocol == "dvrip"`, Vyzio genere une section `go2rtc` dans le `config.yml` Frigate. L'input ffmpeg pointe vers `rtsp://127.0.0.1:8554/{camera_slug}`. Le changement est transparent pour le reste du pipeline Frigate.

**Champ discriminant sur l'entite `Camera` :**

```csharp
[MaxLength(20)]
public string StreamProtocol { get; set; } = "rtsp"; // "rtsp" | "dvrip"
```

**Section `go2rtc` generee dans `config.yml` quand au moins une camera utilise `dvrip` :**

```yaml
go2rtc:
  streams:
    {camera_slug}:
      - dvrip://{username}:{password}@{host}:{port}

cameras:
  {camera_slug}:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/{camera_slug}
          roles:
            - detect
```

## Conséquences

- ✅ Aucun conteneur supplementaire — go2rtc est deja dans Frigate
- ✅ Transparent pour le reste du pipeline : Frigate voit toujours du RTSP
- ✅ Extensible a d'autres protocoles go2rtc supports (rtmp, http-mjpeg, etc.)
- ⚠️ La camera doit etre eveilllee au moment du demarrage de Frigate — go2rtc reessaie mais ne peut pas reveiller une camera en veille profonde
- ⚠️ Migration EF Core necessaire pour le champ `StreamProtocol`
