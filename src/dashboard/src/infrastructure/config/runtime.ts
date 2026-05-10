export interface DashboardRuntime {
  apiBaseUrl: string
  frigateBaseUrl: string
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const resolved = value?.trim() || fallback
  return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved
}

export function getDashboardRuntime(): DashboardRuntime {
  return {
    apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL, window.location.origin),
    frigateBaseUrl: normalizeBaseUrl(import.meta.env.VITE_FRIGATE_BASE_URL, 'http://localhost:5000'),
  }
}