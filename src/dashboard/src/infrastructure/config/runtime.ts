export interface DashboardRuntime {
  apiBaseUrl: string
  frigateBaseUrl: string
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const resolved = value?.trim() || fallback
  if (!resolved) {
    return ''
  }

  return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved
}

export function getDashboardRuntime(): DashboardRuntime {
  // Default to the same host as the dashboard so ExpertView works from any device on the LAN.
  // Override with VITE_FRIGATE_BASE_URL for non-standard deployments (reverse proxy, custom port…).
  const frigateDefaultUrl = `http://${window.location.hostname}:5000`

  return {
    apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL, ''),
    frigateBaseUrl: normalizeBaseUrl(import.meta.env.VITE_FRIGATE_BASE_URL, frigateDefaultUrl),
  }
}
