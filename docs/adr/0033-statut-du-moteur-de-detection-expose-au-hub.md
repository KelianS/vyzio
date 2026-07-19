# ADR-33 — Statut du moteur de détection exposé au Hub

> Statut : Accepté

## Contexte

Le Hub (SPECS §7.2) doit afficher l'état du moteur de détection interne (Frigate — invisible pour
l'utilisateur, cf. `CLAUDE.md` principe produit #2) sur trois paliers : actif, redémarrage en cours,
indisponible. Aujourd'hui, `GET /api/system/stats` (`GetSystemStatsUseCase`) expose seulement un
booléen `Available`, dérivé d'un appel HTTP à `api/stats` de Frigate (`FrigateStatsProvider`) : ce
booléen ne distingue pas un redémarrage volontaire (déclenché par `FrigateConfigApplier.ApplyAsync`,
ex. application d'un changement de réglages ou du mode vie privée) d'une panne réelle.

## Options comparées

1. **Enrichir `/api/system/stats` avec un tracker de redémarrage in-memory.** Un
   `IFrigateRestartTracker` singleton est marqué "en redémarrage" par `FrigateConfigApplier` au moment
   où il lance la commande d'application, avec une fenêtre de validité bornée (timeout) plutôt qu'un
   flag levé explicitement à la fin — le redémarrage réel du conteneur dure plus longtemps que
   l'exécution de la commande qui le déclenche. `GetSystemStatsUseCase` croise ce tracker avec la
   disponibilité réelle des stats pour dériver un statut à trois paliers.
2. Interroger Docker directement (le socket est déjà monté dans `vyzio-api`) pour l'état du
   conteneur Frigate. Écarté : couple l'Application/Infrastructure à Docker pour un besoin produit qui
   ne porte pas sur l'état du conteneur mais sur la disponibilité fonctionnelle du moteur (un
   conteneur "up" peut encore être en train de charger sa configuration).
3. Endpoint dédié `/api/system/frigate-status`, séparé des stats. Écarté : duplique un round-trip déjà
   fait par `/api/system/stats`, pour un statut qui se déduit naturellement de la même réponse.

## Décision

Option 1 : tracker de redémarrage in-memory (fenêtre bornée) + enrichissement de l'endpoint stats
existant. `SystemStatsDto.Available` (booléen) est remplacé par `Status` (`"active" | "restarting" |
"unavailable"`) — usage strictement interne au produit, pas de contrainte de compatibilité
descendante.

## Conséquences

- `IFrigateRestartTracker` (Core/Interfaces, implémentation Infrastructure, singleton) expose
  `MarkRestarting()` et une propriété `IsRestarting` qui s'auto-expire après une fenêtre fixe (évite un
  statut "redémarrage" bloqué indéfiniment si l'application de config échoue silencieusement ou si la
  config générée est invalide).
- `GetSystemStatsUseCase` résout le statut ainsi : stats disponibles → `active` (et lève le tracker au
  passage, résolution automatique) ; stats indisponibles + tracker actif → `restarting` ; sinon →
  `unavailable`.
- Le Hub doit sonder périodiquement l'endpoint pour que le palier "redémarrage" se résolve seul, sans
  rechargement manuel de la page (cohérent avec l'exigence SPECS §7.2 : « sans action de
  l'utilisateur »).
- Aucun libellé ne doit mentionner le nom du composant technique — uniquement « système de détection »
  / « surveillance », conformément au principe produit #2.
