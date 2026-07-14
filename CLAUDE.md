# Vyzio — Routeur de contexte pour l'assistant

Vyzio : vidéosurveillance domestique **privacy-first**, IA locale, plug-and-play, souveraineté FR.
Ce fichier est chargé à chaque session. Il route vers la bonne source ; chaque règle a un foyer unique.

## Avant tout changement significatif

Respecter le workflow : **les documents de cadrage sont alignés avant le code.**
Ordre, exceptions et gouvernance : [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## Quel fichier lire selon la tâche

| Tu travailles sur… | Source |
| --- | --- |
| Besoin / comportement / parcours produit | [`docs/SPECS.md`](docs/SPECS.md) |
| Architecture, frontières, ADR, choix techniques | [`docs/SAD.md`](docs/SAD.md) |
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

## Principes produit (guident chaque décision produit / UX)

Digest — sources : [`README.md`](README.md), [`docs/SPECS.md`](docs/SPECS.md) §1, [`docs/DESIGN SYSTEM.md`](docs/DESIGN%20SYSTEM.md) § Intention.

1. **Public non-technicien** : cacher la complexité, zéro jargon NVR / domotique.
2. **Frigate = détail d'implémentation** : lui déléguer tout ce qu'il couvre (ne pas réinventer le pipeline vidéo), mais le garder **invisible et temporaire** — l'utilisateur ne doit jamais avoir à le connaître, le voir ni le nommer.
3. **Local-first & résilient** : fonctionne hors ligne ; les données restent chez l'utilisateur.
4. **Explicabilité** : pas de score ou d'état opaque sans justification lisible.
5. **Plug & play** : réduire au maximum la friction d'installation et de configuration.
