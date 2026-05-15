# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

### US-P3.5 — Gestion configuration des notification via UI

> But : permettre a l'utilisateur de configurer les canaux de notification via l'interface, l'aider a configurer Telegram et les autres canaux. Permettre de choisir les categories de detection a notifier et les politiques d'alerte associees. Permettre de choisir le format des messages et les informations a inclure.

**Taches :**
- [x] Completer le cadrage SPECS/SAD pour expliciter le parcours UI de configuration des notifications, le modele de destinations et les regles produit a exposer
- [x] Definir le modele metier de configuration des notifications cote Vyzio : destinations, statuts de configuration, regles de diffusion, format de message, resultat des tests d'envoi
- [x] Introduire une persistence dediee a cette configuration dans Vyzio, sans dependre uniquement des options runtime injectees au demarrage
- [x] Definir la strategie de stockage des secrets canal (ex. token Telegram) et la separation entre donnees sensibles, statut produit et historique d'envoi
- [x] Exposer une API de lecture/ecriture pour la configuration des notifications, avec contrats stables pour l'UI
- [x] Exposer une action de test ciblee par destination pour verifier un canal configure sans attendre une vraie detection
- [x] Construire le premier parcours UI guide pour Telegram : etat configure / non configure, saisie assistee, aide de configuration, test d'envoi, retour d'erreur comprehensible
- [x] Etendre le pipeline de notification pour resoudre les destinations actives et les regles applicables depuis la configuration persistante, et non depuis un seul switch Telegram statique
- [x] Introduire un modele de capacites par canal pour afficher clairement ce que chaque destination supporte (image, dependance tierce, prerequis reseau, confidentialite)
- [x] Permettre de configurer au minimum les categories / types d'evenements notifies, le niveau minimal d'alerte et les plages horaires associees
- [x] Permettre de configurer le format du message envoye, avec activation minimale des champs camera, heure, type d'evenement, identite et apercu
- [x] Ajouter les validations backend/frontend, tests unitaires/integration et documentation utilisateur necessaires pour verrouiller le parcours de configuration et le test d'envoi

**Criteres d'acceptation :**
- L'utilisateur peut configurer Telegram depuis l'interface sans modifier de fichier ni redemarrer manuellement le produit
- L'utilisateur voit clairement si une destination est configuree, testee avec succes, en erreur ou inactive
- Une notification de test peut etre envoyee a la demande pour valider la configuration d'un canal
- L'utilisateur peut regler depuis l'interface les destinations actives, les categories d'evenements, le niveau minimal d'alerte et les plages horaires minimales retenues
- Le format du message reste comprehensible, configurable dans les limites du MVP et coherent entre backend, UI et documentation
- Les compromis d'un canal tiers comme Telegram sont affiches explicitement avant activation
- Le pipeline d'envoi applique la configuration persistante courante sans exiger une edition manuelle du runtime


### US-P3.6 — Gestion detections, profils et reconnaissance via UI
> But : Pouvoir configurer ce qui va être détecté, des personnes, animaux, véhicules, etc. Pouvoir reconnaitre une personne en particulier, pas uniquement "person", mais "Alice", "Bob, etc. Pouvoir associer des profils à des caméras, par exemple "Caméra de la porte d'entrée : détecter les personnes, reconnaître Alice et Bob, mais pas les véhicules". Pouvoir avoir une vue claire de ce qui est détecté sur chaque caméra et un historique des détections avec les métadonnées associées (catégorie, identité reconnue, caméra, heure).

**Taches :**
TODO

### US-P3.7 — Live feed, replay détections et enregistrements continus
> But : Avoir depuis l'interface une vue en direct du flux de chaque caméra. Avoir une courte vidéo en replay des dernières secondes avant et après une détection, pour pouvoir vérifier rapidement ce qui s'est passé sans devoir aller chercher les fichiers d'enregistrement. Avoir la possibilité d'activer un enregistrement continu sur certaines caméras, pour pouvoir faire du time-lapse ou de la recherche d'événements sur une période donnée.

**Taches :**
TODO

### US-P3.8 — UI uniformisee, coherent et guidant
> But : mettre de la cohérence entre les pages, les noms, comportements, actions de navigation toujours au même endroit ... La vue principale devra aussi être repensé pour guider l'utilisateur vers les actions de configuration ou la vue d'utilisation du système (feed live camera, notifications, statuts ...)

**Taches :**
TODO

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
