# ADR-09 — Notifications : Telegram (prioritaire) + FCM + canaux alternatifs

> Statut : Accepté

## Contexte

L'exigence clé est de recevoir la **photo de détection directement dans la notification**, y compris hors réseau local. Les canaux de messagerie (Telegram, WhatsApp, etc.) ont été explicitement proposés comme alternative aux notifications push classiques (FCM).

## Comparatif des canaux de messagerie avec support image natif

| Canal | Image native | Setup utilisateur | Compte tiers requis | Open source | Confidentialité image |
|---|:---:|:---:|:---:|:---:|:---:|
| **Telegram Bot** | ✅ sendPhoto API | ✅ Minimal (1 commande) | ✅ Telegram | ✅ Bot API | ⚠️ Image sur serveurs Telegram |
| **WhatsApp Business API** | ✅ | ❌ Très complexe + payant | ✅ Meta | ❌ | ❌ Meta |
| **Signal** | ✅ | ❌ Pas d'API bot officielle | ✅ | ✅ | ✅ E2E |
| **Discord webhook** | ✅ | ✅ Minimal | ✅ Discord | ❌ | ⚠️ Image sur CDN Discord |
| **Matrix (Element)** | ✅ | ⚠️ Moyen | ✅ (self-hostable) | ✅ | ✅ Si auto-hébergé |
| **FCM + tunnel** | ✅ Via URL signée | ⚠️ Tunnel à configurer | ✅ Google | ✅ | ✅ Image reste locale |
| **ntfy** | ✅ Attachment | ✅ (app ntfy) | Non (self-host) | ✅ | ✅ Si auto-hébergé |

**WhatsApp** : API officielle complexe, payante, réservée aux entreprises. Bibliothèques non officielles contre les CGU. Écarté.

**Signal** : pas d'API bot officielle publique. Écarté (pour l'instant).

**Telegram** : Bot API officielle, gratuite, documentée. `sendPhoto` envoie une image JPEG directement dans le message — l'image transite par les serveurs Telegram mais n'est pas exposée publiquement (lien privé par channel ID + token). Setup en 30 secondes avec `@BotFather`. C'est la solution qui résout le plus simplement l'exigence "voir la photo hors réseau".

## Décision

**Canal prioritaire : Telegram Bot**

Telegram résout nativement le problème de l'image hors réseau : la photo est envoyée directement dans le message, visible instantanément sur n'importe quel appareil sans tunnel ni URL signée.

```
Setup utilisateur (30 secondes) :
1. Ouvrir Telegram → chercher @BotFather
2. /newbot → récupérer le token
3. Démarrer une conversation avec son bot → récupérer le chat_id
4. Saisir token + chat_id dans le dashboard Vyzio
```

Intégration .NET via l'API HTTP Telegram (pas de SDK lourd nécessaire) :

```csharp
// Envoi photo + caption via Telegram Bot API
var url = $"https://api.telegram.org/bot{_token}/sendPhoto";
using var form = new MultipartFormDataContent();
form.Add(new StringContent(_chatId), "chat_id");
form.Add(new ByteArrayContent(thumbnailJpeg), "photo", "detection.jpg");
form.Add(new StringContent(caption), "caption");  // "Alice est arrivée • Porte d'entrée • 09:32"
form.Add(new StringContent("HTML"), "parse_mode");
await _http.PostAsync(url, form);
```

**Confidentialité** : la photo transite par les serveurs Telegram. C'est un compromis explicite opt-in : l'utilisateur choisit Telegram en connaissance de cause. Les embeddings et données biométriques ne transitent jamais.

**Canaux complémentaires supportés** (configurables indépendamment) :

| Canal | Usage | Image hors réseau |
|---|---|:---:|
| **Telegram** | Principal — grand public | ✅ Natif |
| **Discord webhook** | Utilisateurs gaming/tech | ✅ Natif |
| **FCM (push natif)** | Utilisateurs souhaitant notification système iOS/Android | ✅ Via URL signée + tunnel |
| **ntfy** | Utilisateurs privacy-first sans Telegram | ✅ Via attachment |
| **Webhook générique** | Intégrations (Home Assistant, n8n) | ✅ URL signée |
| **Email** | Fallback | ✅ Image en pièce jointe |

## Portee technique de la configuration des notifications

La cible technique retenue fait porter a Vyzio la configuration des notifications dans un parcours produit stable, en gardant **Telegram comme premier canal guide** et en preparant les abstractions necessaires pour les canaux complementaires.

Le systeme cible doit introduire les briques suivantes :

- une **configuration de notifications persistante** cote Vyzio, stockee en base, au lieu de dependre uniquement d'options runtime injectees au demarrage ;
- un **modele de destination** par canal, avec etat configure / non configure, etat active / inactive, metadonnees de verification et capacites affichees a l'UI ;
- un **modele de regles de diffusion** regroupant au minimum : categories d'evenements notifiees, niveau minimal d'alerte, plages horaires et options de reduction du bruit ;
- un **modele de format de message** permettant d'activer ou non les principaux champs du message (camera, heure, type, identite, apercu) sans dupliquer les templates par canal ;
- une **API de lecture / ecriture** dediee a la configuration des notifications ;
- un **use case de test cible** par destination, decouple du flux de detection normal, afin de verifier la configuration sans attendre un vrai evenement.

Le `NotificationService` ne doit plus dependre d'un unique snapshot `TelegramDetectionNotificationPolicy` fige au demarrage. Il doit resoudre la configuration active depuis un repository ou un provider applicatif, afin de prendre en compte les reglages effectues depuis l'UI.

Les secrets necessaires a un canal tiers (par exemple `bot_token` Telegram) doivent etre traites comme des donnees sensibles dans la couche Infrastructure. Le SAD ne fixe pas ici la technique exacte de protection, mais impose de separer :

- les secrets du canal ;
- le statut produit expose a l'UI ;
- l'historique des envois et tests de notification.

**URL signée HMAC** (maintenue pour FCM, webhook et ntfy) :

```csharp
public string GenerateSignedThumbnailUrl(string eventId, string baseUrl)
{
    var expires = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds();
    var message = $"{eventId}:{expires}";
    var sig = HMACSHA256.HashData(
        Encoding.UTF8.GetBytes(_secret),
        Encoding.UTF8.GetBytes(message));
    return $"{baseUrl}/api/events/{eventId}/thumbnail?expires={expires}&sig={Convert.ToHexString(sig).ToLower()}";
}
```

## Conséquences

- ✅ Telegram : photo visible hors réseau sans aucune configuration tunnel — le cas d'usage principal est résolu simplement
- ✅ Setup Telegram en 30 secondes, accessible au grand public
- ✅ Discord : alternative naturelle pour les utilisateurs déjà sur Discord
- ✅ FCM + ntfy maintenus pour les utilisateurs préférant les notifications système ou zéro tiers
- ⚠️ Telegram : la photo transite par leurs serveurs — compromis documenté et opt-in explicite
- ⚠️ FCM seul : nécessite un tunnel pour voir la photo hors réseau — plus complexe à configurer
- ✅ P3.5 peut etre livre par increments : configuration UI Telegram d'abord, puis extension aux autres canaux sans reouvrir l'architecture
- ⚠️ La configuration des notifications devient un vrai sous-domaine produit : repository, API, validation, test d'envoi et projection UI doivent rester coherents
