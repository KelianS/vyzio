# V380 PRO

Sur beaucoup de cameras V380 PRO, l'acces video local n'est pas actif par defaut. Pour que Vyzio puisse recuperer le flux, il faut souvent faire une petite manipulation avec une carte micro SD.

Le principe est simple : on place un fichier d'activation sur la carte, on demarre la camera quelques minutes, puis on retire ce fichier.

## Ce qu'il faut avant de commencer

- Avoir l'application **V380 Pro** sur le telephone
- Avoir deja ajoute la camera dans l'application
- Avoir une **carte micro SD**
- Avoir defini un identifiant et un mot de passe pour la camera

## Etapes

1. Ouvrez l'application **V380 Pro** et terminez la configuration normale de la camera.
2. Verifiez que la camera a bien un identifiant et un mot de passe.
3. Telechargez le fichier [ceshi.ini](/api/cameras/vendor-assets/ceshi.ini).
4. Copiez ce fichier a la **racine** de la carte micro SD.
5. Eteignez la camera.
6. Inserez la carte micro SD dans la camera.
7. Rallumez la camera et laissez-la demarrer pendant environ **5 minutes**.
8. Eteignez a nouveau la camera.
9. Retirez la carte micro SD.
10. Supprimez le fichier `ceshi.ini` de la carte.
11. Rallumez la camera.

Apres cela, le flux RTSP est souvent disponible pour Vyzio.

## Si Vyzio demande une adresse de flux

Le format le plus courant est :

- `rtsp://username:password@ipaddress:554/stream1`

Remplacez :

- `username` par l'identifiant de la camera
- `password` par le mot de passe de la camera
- `ipaddress` par l'adresse locale de la camera

## Si cela ne fonctionne pas

- Verifiez que le fichier `ceshi.ini` etait bien a la racine de la carte.
- Laissez la camera allumee environ **5 minutes** avant de retirer la carte.
- Pensez a **supprimer le fichier** de la carte apres l'activation.
- Verifiez que vous utilisez bien les identifiants definis dans la camera.

## A savoir

- Cette methode vient d'une procedure communautaire, pas d'un guide officiel du fabricant.
- Certaines variantes V380 peuvent reagir un peu differemment, mais cette methode fonctionne souvent.

## Mode vie privée

**Niveau de garantie : enregistrement désactivé** — lorsque vous activez le mode vie privée, Vyzio coupe l'accès au flux vidéo via son moteur de détection. Vyzio n'enregistre plus et ne génère plus d'alertes pour cette caméra.

Les cameras V380 PRO n'exposent pas d'API locale permettant de commander un cache physique ou d'éteindre le capteur à distance. Le flux RTSP reste techniquement accessible depuis votre réseau local via l'URL habituelle.

## Liens utiles

- [Telecharger le fichier ceshi.ini](/api/cameras/vendor-assets/ceshi.ini)
- [Guide communautaire V380 PRO](https://gist.github.com/SolveSoul/9be5d9599c8b4b59f7cfa4cd0ce79c9c)