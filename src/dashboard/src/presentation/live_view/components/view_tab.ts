/** The two tabs under the picture (LIVE-19). */
export const ViewTab = {
  Controls: 'controls',
  Detections: 'detections',
} as const

export type ViewTab = (typeof ViewTab)[keyof typeof ViewTab]

/** The tab an address names, Contrôles when it names none. */
export function viewTabOf(value: string | null): ViewTab {
  return value === ViewTab.Detections ? ViewTab.Detections : ViewTab.Controls
}
