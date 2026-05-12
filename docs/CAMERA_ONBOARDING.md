# Parcours camera

> Mai 2026 — mode d'emploi du parcours guide Vyzio

---

## Objectif

Permettre d'ajouter une camera dans Vyzio sans edition manuelle de fichier Frigate.

Le parcours est disponible depuis le hub, section **Cameras**.

---

## Ce que fait le parcours

1. **Decouverte reseau**
   - Vyzio tente une decouverte ONVIF sur le reseau local.
   - En environnement de dev, un flux RTSP mock peut aussi remonter comme candidat.
2. **Saisie manuelle**
   - Si aucune camera n'est detectee, l'utilisateur peut saisir le nom, l'hote, le port et le chemin RTSP.
3. **Ajout au catalogue**
   - La camera est enregistree dans le catalogue Vyzio avec un statut brouillon.
4. **Verification du flux**
   - Vyzio verifie que le flux RTSP repond avant application.
5. **Application a Frigate**
   - Vyzio regenere le fichier `frigate.generated.yml` puis relance Frigate pour appliquer la nouvelle configuration.

---

## Prerequis runtime

Le parcours complet suppose que :

- `config/frigate.generated.yml` est le fichier effectivement monte dans Frigate ;
- l'API Vyzio peut ecrire dans le dossier `config/` ;
- la commande d'application Frigate est configuree dans `config/vyzio.yml` ;
- en Docker Compose, le conteneur API a acces au socket Docker pour executer `docker restart vyzio-frigate`.

Configuration actuelle :

- fichier de configuration Frigate genere : `config/frigate.generated.yml`
- commande d'application : `docker restart vyzio-frigate`

---

## Utilisation

1. Ouvrir le hub Vyzio.
2. Cliquer sur **Cameras**.
3. Cliquer sur **Decouverte reseau**.
4. Si un candidat apparait, cliquer dessus pour pre-remplir le formulaire.
5. Completer ou corriger le nom, l'hote, le port et le chemin RTSP.
6. Cliquer sur **Ajouter au catalogue**.
7. Selectionner la camera creee dans le catalogue.
8. Cliquer sur **Verifier le flux**.
9. Une fois le statut confirme, cliquer sur **Appliquer a Frigate**.

---

## Limites connues

- La decouverte reseau assistee repose d'abord sur ONVIF ; certaines cameras peuvent ne pas etre detectees automatiquement.
- La verification actuelle confirme la reponse du flux RTSP ; elle ne couvre pas encore un apercu video riche dans le hub.
- Les reglages avances Frigate restent hors du parcours nominal et doivent passer par le mode expert.

---

## Depannage rapide

- Si la decouverte ne remonte rien : utiliser la saisie manuelle.
- Si la verification echoue : verifier l'hote, le port, les identifiants et le chemin RTSP.
- Si l'application echoue : verifier que Docker est accessible depuis l'API Vyzio et que le conteneur `vyzio-frigate` existe bien.