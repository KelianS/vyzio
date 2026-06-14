# Mode vie privée

Le mode vie privée permet de suspendre la surveillance sur une ou plusieurs caméras, manuellement ou selon un horaire programmé. Pendant ce mode, aucune détection n'est effectuée et aucune alerte n'est générée.

---

## Activation manuelle

### Sur une caméra

1. Ouvrez la fiche de la caméra (cliquez sur son nom ou son aperçu).
2. Dans la section **Mode vie privée**, activez ou désactivez le bouton bascule.
3. Le changement est appliqué immédiatement.

### Sur toutes les caméras à la fois

Depuis la page d'accueil, utilisez le bouton **Mode vie privée global** (en haut à droite du hub). Une modale de confirmation vous demande de valider avant d'agir sur l'ensemble des caméras.

---

## Programmation horaire

Vous pouvez définir des plages horaires pendant lesquelles la caméra passe automatiquement en mode vie privée.

### Ajouter un horaire

1. Ouvrez la fiche de la caméra.
2. Dans la section **Horaires de confidentialité**, cliquez sur **Ajouter un horaire**.
3. Choisissez les jours de la semaine, l'heure de début et l'heure de fin.
4. Enregistrez. La caméra se coupera automatiquement à l'entrée dans la plage et reprendra à la sortie.

### Règles importantes

- **Priorité manuelle** : si vous avez activé le mode manuellement, le planificateur ne le désactivera pas automatiquement à la fin de la plage. Vous devrez le désactiver vous-même.
- **La désactivation automatique** ne fonctionne que si le mode a été activé *par le planificateur* (source `schedule`). Elle n'affecte pas les activations manuelles.
- Les horaires ne supportent pas le passage minuit (ex. 22:00–02:00). Créez deux horaires distincts dans ce cas : 22:00–23:59 et 00:00–02:00.

---

## Différence entre "vraiment éteinte" et "enregistrement désactivé"

Vyzio affiche l'une des deux mentions dans l'aperçu live d'une caméra en mode vie privée :

| Mention | Signification |
|---|---|
| **Caméra coupée — matériel** | La caméra a baissé son cache physique (objectif masqué, LED éteinte). Aucune image n'est captée, même en dehors de Vyzio. Réservé aux caméras compatibles (ex. Tapo). |
| **Caméra en pause — enregistrement désactivé** | L'enregistrement et la détection sont désactivés dans Vyzio, mais le flux vidéo reste actif sur la caméra. |

La coupure matérielle est appliquée automatiquement sur les caméras compatibles. Pour les autres modèles, seul l'enregistrement est suspendu.

---

## Comportement après redémarrage de Vyzio

- Les activations **manuelles** sont persistées en base de données. La caméra reste en mode vie privée après un redémarrage.
- Les horaires **programmés** sont réévalués au démarrage. Si l'heure courante est dans une plage active, la caméra sera automatiquement coupée.

---

## Marques supportées (coupure matérielle)

| Marque / Famille | Coupure matérielle | Mécanisme |
|---|---|---|
| TP-Link Tapo | Oui | Cache objectif physique via API KLAP locale |
| V380 Pro | Oui | Commande locale propriétaire |
| ICSee / XMEye | Oui | Commande locale propriétaire |
| Autres (ONVIF, RTSP générique) | Non | Enregistrement désactivé uniquement |
