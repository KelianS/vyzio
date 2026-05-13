# V380 PRO

## Summary
Les cameras V380 PRO ont RTSP et ONVIF desactives par defaut. L'activation passe par un fichier `ceshi.ini` place a la racine d'une carte micro SD.

## Prerequisites
- Avoir une carte micro SD accessible pour y copier un fichier a la racine.
- Associer d'abord la camera a l'application V380 Pro.
- Definir un identifiant et un mot de passe personnalises sur la camera avant d'activer RTSP.

## Steps
### action: Installer l'application
Telechargez l'application V380 Pro depuis l'App Store ou Google Play, puis ouvrez-la.

### action: Associer la camera
Demarrez la camera, associez-la a l'application et finalisez la configuration initiale.

### action: Definir les identifiants
Configurez un nom d'utilisateur et un mot de passe personnalises pour la camera.

### action: Telecharger le fichier d'activation
Recuperez le fichier `ceshi.ini` puis copiez-le a la racine de la carte micro SD, sans le placer dans un sous-dossier.

### warning: Inserer la carte puis redemarrer
Eteignez la camera, inserez la carte micro SD, rallumez-la puis attendez environ 5 minutes. La camera annonce vocalement l'operation en chinois.

### action: Retirer la carte et nettoyer le fichier
Eteignez a nouveau la camera, retirez la carte micro SD, supprimez `ceshi.ini` de la carte, puis rallumez la camera.

### check: Tester le flux RTSP
Utilisez ensuite le flux `rtsp://username:password@ipaddress:554/live/ch00_0` avec les identifiants definis plus tot.

## Caveats
- Le fichier `ceshi.ini` ne doit rester sur la carte que pour l'activation initiale.
- Certaines variantes V380 peuvent demander un delai un peu plus court, mais 5 minutes est la marge la plus sure.
- Cette procedure repose sur une methode communautaire, donc elle reste classee en support experimental.

## Links
- [Guide communautaire V380 PRO](https://gist.github.com/SolveSoul/9be5d9599c8b4b59f7cfa4cd0ce79c9c)