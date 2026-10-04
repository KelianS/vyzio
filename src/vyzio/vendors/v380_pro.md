# V380 PRO

## Avant d'ajouter la caméra

Sur beaucoup de V380 PRO, l'accès vidéo local est coupé d'origine. Une carte micro SD permet de le rouvrir, selon un [guide communautaire](https://gist.github.com/SolveSoul/9be5d9599c8b4b59f7cfa4cd0ce79c9c) et non du fabricant.

1. Dans l'application **V380 Pro**, ajoutez la caméra et donnez-lui un identifiant et un mot de passe.
2. Téléchargez le fichier [ceshi.ini](/api/cameras/vendor-assets/ceshi.ini) et copiez-le à la **racine** d'une carte micro SD.
3. Caméra éteinte, insérez la carte, puis rallumez la caméra et laissez-la démarrer environ **5 minutes**.
4. Éteignez la caméra, retirez la carte et supprimez-en le fichier `ceshi.ini`.
5. Rallumez la caméra et revenez ici : Vyzio vous demandera l'identifiant et le mot de passe choisis.

## Si cela ne fonctionne pas

- Le fichier doit être à la racine de la carte, pas dans un dossier.
- Laissez la caméra allumée 5 minutes complètes avant de retirer la carte.
- Vérifiez l'identifiant et le mot de passe définis dans l'application V380 Pro.
