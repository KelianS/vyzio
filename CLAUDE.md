# Vyzio — Routeur de contexte pour l'assistant

Vyzio : vidéosurveillance domestique **privacy-first**, IA locale, plug-and-play, souveraineté FR.
Ce fichier est chargé à chaque session. Il route vers la bonne source ; chaque règle a un foyer unique.

## ⛔ Règle suprême — zéro duplication

Une information a **un seul foyer** : le fichier qui en est la source. Partout ailleurs, on la
**référence**, jamais on ne la recopie. Avant d'écrire quoi que ce soit (doc, règle, principe),
vérifier que ça n'existe pas déjà ; si oui, pointer vers la source au lieu de dupliquer.

Seule tolérance : un **résumé bref citant sa source** — comme les « Principes produit » plus bas,
qui condensent README / SPECS sans les remplacer.

## Avant tout changement significatif

Respecter le workflow : **les documents de cadrage sont alignés avant le code.**
Ordre, exceptions et gouvernance : [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## Quel fichier lire selon la tâche

| Tu travailles sur… | Source |
| --- | --- |
| Besoin / comportement / parcours produit | [`docs/SPECS.md`](docs/SPECS.md) |
| Architecture d'ensemble, frontières, choix transverses | [`docs/SAD.md`](docs/SAD.md) |
| Une décision d'architecture précise (le *pourquoi* d'un choix) | [`docs/adr/`](docs/adr/) (index [`README`](docs/adr/README.md)) |
| Fonctionnement détaillé d'un composant (le *comment*) | [`docs/design/`](docs/design/) (catalogue [`README`](docs/design/README.md)) |
| Ordre d'exécution, découpage, priorités | [`docs/BACKLOG.md`](docs/BACKLOG.md) |
| UI du dashboard : boutons, pastilles, modales, tokens | [`docs/DESIGN SYSTEM.md`](docs/DESIGN%20SYSTEM.md) |
| Mode d'emploi d'une feature livrée | [`docs/user/`](docs/user/) |
| Processus, workflow, gouvernance des docs | [`docs/WORKFLOW.md`](docs/WORKFLOW.md) |
| Setup, docker, variables d'env, tâches | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Vision, positionnement | [`README.md`](README.md) |

Les règles **backend** ([`src/vyzio/CLAUDE.md`](src/vyzio/CLAUDE.md)) et **frontend**
([`src/dashboard/CLAUDE.md`](src/dashboard/CLAUDE.md)) se chargent automatiquement dès que tu édites
un fichier de ces dossiers.

## Invariants (partout, sans exception)

- **Privacy first** : jamais transmettre d'images sans consentement explicite.
- Code (noms, commentaires) en anglais ; vision et docs de cadrage en français.
- **Commits et PR** (titre et description) : en anglais, format Conventional Commits — règle et
  gabarit dans [`docs/WORKFLOW.md`](docs/WORKFLOW.md) § Git.
- **Commentaire de code** : une ligne, jamais un paragraphe. Le *pourquoi* non déductible, avec une
  référence d'ADR si besoin (`(ADR-44)`) — jamais le récit de la décision, qui vieillit en silence et
  duplique l'ADR (règle suprême ci-dessus). Si l'explication ne tient pas en une ligne, elle
  appartient à un ADR ou un TAD ; y renvoyer plutôt que la recopier.

## Principes produit (guident chaque décision produit / UX)

Digest — sources : [`README.md`](README.md), [`docs/SPECS.md`](docs/SPECS.md) §1, [`docs/DESIGN SYSTEM.md`](docs/DESIGN%20SYSTEM.md) § Intention.

1. **Public non-technicien** : cacher la complexité, zéro jargon NVR / domotique.
2. **Frigate = détail d'implémentation** : lui déléguer tout ce qu'il couvre (ne pas réinventer le pipeline vidéo), mais le garder **invisible et temporaire** — l'utilisateur ne doit jamais avoir à le connaître, le voir ni le nommer.
3. **Local-first & résilient** : fonctionne hors ligne ; les données restent chez l'utilisateur.
4. **Explicabilité** : pas de score ou d'état opaque sans justification lisible.
5. **Plug & play** : réduire au maximum la friction d'installation et de configuration.
6. **Contrôle unifié des caméras** : piloter chaque caméra directement (PTZ, vie privée matérielle, réglages, à terme Wi-Fi), protocole propriétaire si besoin — pour affranchir l'utilisateur des apps constructeur.
