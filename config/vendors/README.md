# Catalogue constructeur

Chaque fichier `*.md` de ce dossier correspond a une famille constructeur detectee par Vyzio.
Le nom du fichier doit correspondre a la cle `vendorFamily` retournee par la decouverte, par exemple `v380_pro.md`.

## Format attendu

Le contenu est maintenant rendu tel quel dans l'interface via un composant Markdown. Tu peux donc ecrire librement :

```md
# V380 PRO

RTSP et ONVIF sont desactives par defaut.

## Etapes

1. Associer la camera a l'application.
2. Copier `ceshi.ini` a la racine d'une carte micro SD.
3. Redemarrer la camera.

## Liens

- [Guide communautaire](https://example.com)
- [Autre ressource](https://example.com)
```

## Notes

- Les liens Markdown standards `[label](url)` sont cliquables dans l'UI.
- Les titres, listes numerotees, listes a puces, blocs de code et paragraphes sont supportes.
- Le contenu est recharge a chaque decouverte, donc modifier le fichier suffit pour mettre a jour la notice.