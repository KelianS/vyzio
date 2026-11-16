/** At most one: an end instant, or a duration in minutes from now; neither holds until the user ends it. */
export type ChosenEnd = { until: string } | { minutes: number } | Record<string, never>
