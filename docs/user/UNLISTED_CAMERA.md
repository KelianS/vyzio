# Ma caméra n'est pas dans la liste — configuration manuelle des capacités

Vyzio reconnaît nativement les caméras **certifiées**. Si votre caméra utilise un autre fabricant, vous pouvez quand même activer le contrôle PTZ ou le mode vie privée, à condition que votre caméra supporte l'un des protocoles standard.

---

## Prérequis

- La caméra est déjà ajoutée dans Vyzio (flux RTSP fonctionnel).
- Vous avez accès à la fiche de la caméra (cliquez sur son nom depuis le hub).
- Votre caméra doit parler l'un des protocoles suivants :
  - **ONVIF** (port 8899) — standard industriel, supporté par Hikvision, Dahua, Reolink, Axis et la grande majorité des caméras PTZ du marché
  - **DVRIP** (port 34567) — chipset Xiongmai (ICSee, Annke, Sannce, Zosi…)
  - **Tapo KLAP** — caméras TP-Link Tapo uniquement

---

## Configurer une capacité

1. Ouvrez la **fiche de la caméra**.
2. Faites défiler jusqu'à la section **Capacités**.
3. Un message indique que la caméra n'est pas dans le catalogue — c'est normal.
4. Sélectionnez la **capacité** à configurer : PTZ ou Mode vie privée.
5. Sélectionnez le **protocole** correspondant à votre caméra.
6. Cliquez sur **Configurer et tester**.

Vyzio envoie immédiatement une commande de test sur la caméra. Si la connexion aboutit, la capacité est marquée **Vérifiée** et devient disponible.

---

## Si le test échoue

- Vérifiez que la caméra est joignable sur le réseau (ping ou accès à son interface web).
- Vérifiez que le port du protocole est ouvert (ONVIF : 8899, DVRIP : 34567).
- Vérifiez les identifiants — ce sont les mêmes que ceux saisis lors de l'ajout de la caméra.
- Essayez un autre protocole si votre caméra en supporte plusieurs (ex. certaines caméras Xiongmai exposent à la fois DVRIP et ONVIF).

Une capacité dont le test échoue n'est **jamais proposée comme active**. Vous pouvez relancer le test à tout moment depuis la fiche de la caméra.

---

## Limites connues

| Capacité | Protocole | Limites |
|---|---|---|
| PTZ | ONVIF | Certains firmwares d'entrée de gamme (ex. V380 Pro) ont un serveur ONVIF mono-thread : les commandes prennent ~3 s à répondre, le step précis est difficile. |
| PTZ | DVRIP | Le protocole est propriétaire Xiongmai — fonctionne sur la grande majorité des caméras ICSee/XMEye mais pas sur les clones tiers. |
| Mode vie privée | PTZ parking | Nécessite que la capacité PTZ soit déjà vérifiée sur la même caméra. |

---

## Faire reconnaître la marque nativement

Si vous avez réussi à configurer une caméra d'une marque non listée et que vous souhaitez qu'elle soit reconnue automatiquement, consultez [le guide de contribution](../../src/vyzio/vendors/README.md).
