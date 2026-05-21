# ICSee (XMEye / WONSDAR)

Les cameras ICSee — vendues sous de nombreuses marques generiques (WONSDAR, Netvue, ieGeek, etc.) — utilisent un firmware **XMEye / ICSee** qui desactive le RTSP par defaut. Il faut l'activer manuellement depuis l'application.

## Ce qu'il faut avant de commencer

- Avoir l'application **ICSee** (ou **XMEye** selon le modele) sur le telephone
- Avoir deja ajoute la camera dans l'application
- Avoir defini un identifiant et un mot de passe pour la camera

## Activer le RTSP dans l'application ICSee

1. Ouvrez l'application **ICSee** et selectionnez la camera.
2. Appuyez sur l'icone **Parametres** (engrenage).
3. Allez dans **Reglages avances** → **Protocole video** ou **RTSP**.
4. Activez **RTSP** et notez le port (par defaut **554**).
5. Appuyez sur **Enregistrer** et attendez que la camera redemarre.

> **Onglet Reglages avances vide ?** Certains modeles sur batterie n'exposent pas ces options — ils fonctionnent exclusivement via le cloud ICSee et ne supportent pas le RTSP local. Voir la section ci-dessous.

## Si Vyzio demande une adresse de flux

Les formats les plus courants sur les cameras ICSee/XMEye sont :

- `rtsp://admin:password@ipaddress:554/user=admin&password=PASSWORD&channel=1&stream=0.sdp` (flux principal)
- `rtsp://admin:password@ipaddress:554/user=admin&password=PASSWORD&channel=1&stream=1.sdp` (flux secondaire)
- `rtsp://admin:password@ipaddress:554/cam/realmonitor?channel=1&subtype=0` (format alternatif)

Remplacez :

- `admin` par le nom d'utilisateur defini dans l'application
- `password` / `PASSWORD` par le mot de passe de la camera
- `ipaddress` par l'adresse locale de la camera

## Cameras sur batterie

Les cameras sur batterie ICSee entrent en **veille** quand elles ne detectent pas de mouvement. Pendant la veille, la camera ne repond pas sur le reseau et le flux RTSP est inaccessible.

- Le flux RTSP est disponible uniquement quand la camera est **active** (LED allumee, mouvement en cours, ou branched sur secteur).
- Dans l'application ICSee, activez le **mode camera de securite** ou configurez un **reveil programme** si votre modele le supporte.
- Certains modeles proposent un mode **toujours connecte** au prix d'une plus grande consommation de batterie.

## Si cela ne fonctionne pas

- Verifiez que le RTSP est bien active dans les parametres avances.
- Assurez-vous que la camera et Vyzio sont sur le meme reseau local.
- Si la camera est sur batterie, veillez a ce qu'elle soit en mode actif au moment de la configuration.
- Essayez les deux formats d'URL RTSP disponibles — certains modeles repondent uniquement a l'un d'eux.

## Cameras cloud-only (pas de RTSP local)

Certains modeles sur batterie ne supportent pas le RTSP local et communiquent uniquement via le relais P2P ICSee (internet). Signes caracteristiques :

- L'onglet **Reglages avances** est vide dans l'application ICSee
- Le port 554 est ferme sur la camera
- Le port 34567 repond mais uniquement au protocole XMEye proprietaire

Dans ce cas, il n'est pas possible d'integrer directement la camera dans Vyzio. Une alternative avancee consiste a utiliser **go2rtc** comme passerelle avec une URL de type `dvrip://admin:password@ip:34567`, mais ce mode n'est pas supporte sur tous les modeles et necessite une configuration manuelle de Frigate.

## A savoir

- Le firmware ICSee/XMEye est utilise par de nombreux fabricants OEM (WONSDAR, ieGeek, etc.) ; les menus varient selon le modele.
- Certaines cameras ICSee supportent aussi ONVIF (a activer dans les memes parametres avances).
- Les cameras sur secteur ont generalement plus d'options que les modeles sur batterie.
