# TP-Link Tapo

Si votre camera Tapo n'apparait pas encore correctement dans Vyzio, il faut souvent autoriser l'acces video local depuis l'application Tapo.

Le plus important : il faut creer un **compte camera** dans l'application. Ce n'est **pas** le meme mot de passe que votre compte Tapo habituel.

## Ce qu'il faut avant de commencer

- Avoir l'application **Tapo** sur le telephone
- Etre connecte au **meme reseau Wi-Fi** que la camera
- Avoir acces a la camera dans l'application Tapo

## Etapes dans l'application Tapo

1. Ouvrez l'application **Tapo**.
2. Ouvrez votre camera.
3. Allez dans les **parametres** de la camera.
4. Ouvrez **Advanced Settings**.
5. Ouvrez **Camera Account**.
6. Creez un identifiant et un mot de passe pour la camera.

Apres cette etape, la camera peut en general etre utilisee par Vyzio sur votre reseau local.

## Si Vyzio demande une adresse de flux

Dans la plupart des cas, vous n'aurez pas besoin de saisir cela a la main. Si c'est necessaire, les formats les plus courants sont :

- Qualite principale : `rtsp://username:password@ip-address:554/stream1`
- Qualite secondaire : `rtsp://username:password@ip-address:554/stream2`

Remplacez :

- `username` par l'identifiant du **compte camera**
- `password` par le mot de passe du **compte camera**
- `ip-address` par l'adresse locale de la camera

## Si cela ne fonctionne pas

- Verifiez que vous utilisez bien le **compte camera**, et non votre compte Tapo principal.
- Verifiez que le telephone, Vyzio et la camera sont sur le **meme reseau local**.
- Si le premier flux ne fonctionne pas, essayez `stream2`.
- Certaines cameras **sur batterie** ne proposent pas ce mode. Si besoin, verifiez le modele exact.

## A savoir

- Cette fonction marche surtout pour les modeles Tapo branches en continu.
- Certaines cameras ou sonnettes sur batterie peuvent ne pas etre compatibles.

## Mode vie privée

**Niveau de garantie : PTZ parking.** Vyzio oriente physiquement la caméra vers une position de
repos et arrête l'enregistrement au même moment. La caméra ne regarde plus la pièce, et Vyzio
n'enregistre plus.

Les caméras Tapo savent aussi fermer un cache d'objectif et éteindre leur LED, ce qui serait une
garantie plus forte. Cette commande passe par le protocole privé de TP-Link, que Vyzio ne sait pas
encore parler : elle n'est donc pas proposée plutôt que d'être annoncée sans fonctionner.

> **À savoir** : si vous activez le mode vie privée depuis l'application Tapo, la caméra refuse les
> commandes d'orientation tant qu'il est actif. C'est normal, et Vyzio vous le dira au lieu de faire
> semblant d'avoir bougé.

---

## Contrôle PTZ (caméras pan-tilt)

Les modèles pan-tilt Tapo (**C200, C210, C225** et versions ultérieures) s'orientent depuis Vyzio,
avec les mêmes identifiants **compte camera** que le flux vidéo. Aucun compte TP-Link n'est
nécessaire.

Les positions enregistrées dans l'application Tapo sont reconnues et réutilisées telles quelles :
vos points de vue restent les vôtres.

**Cette capacité est vérifiée une fois depuis la fiche de la caméra.** Dans la section *Capacités*,
cliquez sur **Tester** à côté de « Contrôle PTZ ». Si la commande aboutit, le panneau de contrôle
apparaît dans la vue live.

---

## Réglages image

Luminosité, contraste, saturation, netteté et filtre infrarouge sont réglables depuis Vyzio, sur la
fiche de la caméra.

---

## Liens utiles

- [Guide TP-Link Tapo](https://www.tapo.com/en/faq/34/)
- [Aide sur le compte camera](https://www.tapo.com/faq/76/)
