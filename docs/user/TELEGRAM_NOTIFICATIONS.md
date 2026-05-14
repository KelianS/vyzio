# Notifications Telegram

## But

Recevoir une notification Telegram simple et intelligible quand Vyzio detecte un evenement prioritaire.

## Configuration

Renseigner la section `notifications.telegram` dans `config/vyzio.yml` :

```yaml
notifications:
  minimum_confidence: 0.75
  telegram:
    bot_token: "<telegram-bot-token>"
    chat_id: "<telegram-chat-id>"
```

## Comportement MVP

Vyzio envoie un message Telegram uniquement si les conditions suivantes sont reunies :

- le canal Telegram est configure ;
- l'evenement est un evenement `new` ;
- la detection represente une `person`, ou une identite a deja ete enrichie ;
- la confiance est superieure ou egale a `minimum_confidence` quand elle est disponible ;
- une notification Telegram `sent` n'existe pas deja pour cet evenement.

Le message contient le sujet detecte, la camera et l'heure de detection.

Exemple :

```text
Alice detectee - front door - 10:15
```

## Limites actuelles

- le MVP envoie un message texte simple ;
- l'image n'est pas encore jointe au message Telegram ;
- les regles avancees par profil, horaires ou plages de silence ne sont pas encore implementees.