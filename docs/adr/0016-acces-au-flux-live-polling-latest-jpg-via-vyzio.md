# ADR-16 — Accès au flux live : polling latest.jpg via Vyzio, Frigate non exposé

> Statut : Accepté

## Contexte

L'interface Vyzio doit permettre de visualiser le flux en direct de chaque caméra. L'objectif est de minimiser le couplage réseau direct vers Frigate : le navigateur ne doit jamais connaître l'existence de Frigate ni s'y connecter directement. Vyzio est le seul point d'entrée réseau.

## Endpoints live Frigate disponibles

```
GET  /api/{name}/latest.jpg                  → dernière frame JPEG (polling)
WS   /live/jsmpeg/{name}                     → flux MPEG1 via WebSocket (jsmpeg)
GET  /live/hls/{name}/index.m3u8             → HLS via go2rtc
GET  /live/webrtc/api/ws?src={name}          → WebRTC via go2rtc (peer-to-peer — non proxifiable)
```

**Constat terrain :** Frigate utilise WebSocket + jsmpeg pour son propre live feed — pas de flux MJPEG HTTP natif. WebRTC et jsmpeg sont non proxifiables sans infrastructure dédiée (TURN server, media relay).

## Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Polling latest.jpg via Vyzio** | `GET /api/cameras/{id}/live/latest.jpg` → proxy Frigate `/api/{slug}/latest.jpg`, rafraîchi à 1fps | Frigate jamais exposé ; 0 dépendance ; fiable sur tout réseau | ~1fps max ; qualité snapshot (pas de streaming fluide) |
| **B — Proxy WebSocket jsmpeg** | Vyzio bridgerait le WebSocket Frigate → navigateur | Fluide (~15fps) | Implémentation complexe (WS bridge ASP.NET Core) ; dépendance jsmpeg.js côté UI |
| **C — Proxy HLS Vyzio** | Proxy m3u8 + segments .ts, réécriture URLs | Bonne qualité, seeking possible | Complexe (URL rewriting) ; latence ~3-5s |
| **D — URL directe Frigate** | Vyzio retourne l'URL Frigate, navigateur se connecte directement | Zéro overhead | Frigate exposé — **non acceptable** |

## Décision

**Option A retenue : proxy polling `latest.jpg` via `GET /api/cameras/{id}/live/latest.jpg`.**

Vyzio proxifie la dernière frame JPEG de Frigate. Le frontend rafraîchit l'URL toutes les secondes avec un paramètre de cache-busting (`?t=timestamp`) — aucune bibliothèque vidéo requise, aucune connexion WebSocket, implémentation minimale.

Frigate est **uniquement accessible sur le réseau Docker interne** (`vyzio-net`). Le port 5000 n'est pas publié sur l'interface hôte en production.

```csharp
// Implémentation backend
app.MapGet("/api/cameras/{id}/live/latest.jpg", async (string id, IFrigateRestClient frigate, CancellationToken ct) =>
{
    var frigateCamera = camera.FrigateCameraName ?? camera.Slug.Replace('-', '_');
    var response = await frigate.GetLatestFrameAsync(frigateCamera, ct);
    if (!response.IsSuccessStatusCode) return Results.StatusCode((int)response.StatusCode);
    return Results.Stream(await response.Content.ReadAsStreamAsync(ct), "image/jpeg");
});
```

```tsx
// Implémentation frontend — polling avec cache-busting
function CameraLiveView({ cameraId, apiBaseUrl }) {
  const [src, setSrc] = useState(`${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`)
  useEffect(() => {
    const id = setInterval(() => setSrc(`...?t=${Date.now()}`), 1000)
    return () => clearInterval(id)
  }, [cameraId])
  return <img src={src} />
}
```

**Bande passante estimée :** 1 requête/s, ~20–80 KB par frame JPEG 720p ≈ 20–80 KB/s par caméra — très acceptable sur LAN domestique.

## Conséquences

- ✅ Frigate jamais exposé au navigateur — réseau simple, un seul point d'entrée (Vyzio)
- ✅ 0 dépendance côté UI (pas de jsmpeg.js, pas de HLS.js)
- ✅ Implémentation minimale et fiable — un simple GET proxifié
- ✅ Compatible accès distant sans révision réseau
- ⚠️ ~1fps — suffisant pour un aperçu de surveillance, pas pour un monitoring temps réel
- ⚠️ Si un live fluide devient nécessaire, l'option B (WebSocket jsmpeg proxy) est le chemin naturel
