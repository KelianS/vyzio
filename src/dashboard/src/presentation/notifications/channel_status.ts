/** Whether a configured channel sends, in one sentence shared by the list and the channel's page. */
export function sendingSentence(enabled: boolean): string {
  return enabled
    ? 'Les notifications sont envoyées.'
    : 'Configuré, mais aucune notification n’est envoyée.'
}
