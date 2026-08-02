/**
 * Applique le theme sombre en posant une classe sur `<html>`, que les tokens
 * lisent (`index.css`). Passer par une classe plutot que par la seule requete
 * media est ce qui rendra un choix explicite possible sans retoucher le CSS.
 *
 * Le theme sombre est supporte partout (ADR-42) : chaque couleur employee est un
 * token qui porte ses deux valeurs, donc aucun ecran bati sur le socle n'a a
 * s'en occuper.
 *
 * ## Pourquoi ce module n'est pas encore branche
 *
 * Mesure faite avant d'ecrire ces lignes : avec `prefers-color-scheme: dark`,
 * l'application rendait **exactement le theme clair**. Les quelques requetes
 * media presentes dans `App.css` ne suffisaient pas — il n'y a jamais eu de
 * theme sombre fonctionnel.
 *
 * L'activer maintenant ne revelerait donc pas une dette existante : cela
 * *introduirait* des defauts de contraste sur des ecrans qui n'ont jamais eu de
 * couleurs sombres (logo du bandeau, encarts a fond clair en dur). Les corriger
 * demanderait de retoucher `App.css`, c'est-a-dire du code programme pour la
 * suppression.
 *
 * Il est donc branche avec la coquille de navigation, premier ecran bati sur le
 * socle : a partir de la, le theme sombre est acquis par construction pour tout
 * ce qui est repris, et aucun ecran ne le perd en route.
 */

const DARK_CLASS = 'dark'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function apply(dark: boolean) {
  document.documentElement.classList.toggle(DARK_CLASS, dark)
}

/**
 * Aligne le theme sur la preference systeme et le maintient aligne.
 * Renvoie de quoi arreter l'ecoute.
 */
export function startThemeSync(): () => void {
  const query = window.matchMedia(DARK_QUERY)
  apply(query.matches)

  const onChange = (event: MediaQueryListEvent) => apply(event.matches)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
