# Dashboard Design System

## Intention

Le Hub Vyzio doit paraitre rassurant, lisible et domestique, sans reprendre l'esthetique d'un outil NVR expert.

Le design MVP repose sur une interface claire, lumineuse et calme, avec une hierarchie visuelle simple :

- un etat systeme visible immediatement ;
- des evenements recents lisibles en un coup d'oeil ;
- des actions principales explicites ;
- un acces avance vers Frigate, present mais secondaire.

## Palette MVP

- `--bg-canvas: #f4efe6` : fond principal chaud, non clinique.
- `--bg-elevated: #fffaf2` : surfaces principales.
- `--bg-strong: #1f3a33` : panneaux fonces structurants.
- `--ink-strong: #18201d` : texte principal.
- `--ink-soft: #53605b` : texte secondaire.
- `--line-soft: #d8cfbf` : bordures discretes.
- `--brand-moss: #2f6b59` : couleur produit principale.
- `--brand-sand: #d9b37a` : accent chaud pour la mise en avant.
- `--alert-high: #c65c3d` : evenement prioritaire.
- `--alert-ok: #2d7a52` : etat sain.

## Regles d'usage

- Les surfaces critiques utilisent `--bg-elevated` pour garder un contraste doux.
- La couleur `--brand-moss` porte les CTA et les indicateurs produit.
- La couleur `--alert-high` est reservee aux evenements importants et aux statuts d'attention.
- L'acces avance Frigate doit rester visible, mais jamais presenter comme le parcours principal.

## Tokens d'interface

- Rayon principal : `24px`
- Rayon secondaire : `18px`
- Ombre douce : `0 18px 50px rgba(24, 32, 29, 0.08)`
- Espacement de section : `24px` a `32px`

## Vocabulaire UX MVP

- Dire `Hub`, `Evenements`, `Profils`, `Alertes`, `Mode avance`.
- Eviter `MQTT`, `broker`, `frigate events`, `sub_label`, `NVR` dans le parcours nominal.