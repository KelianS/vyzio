export interface VendorLinkTarget {
  href: string
  download: boolean
}

const vendorAssetPrefix = '/api/cameras/vendor-assets/'
const absoluteSchemePattern = /^[a-z][a-z0-9+.-]*:/i

export function resolveVendorLinkTarget(href: string | null | undefined): VendorLinkTarget | null {
  if (!href?.trim()) {
    return null
  }

  const normalizedHref = href.trim()

  if (absoluteSchemePattern.test(normalizedHref) || normalizedHref.startsWith('#')) {
    return {
      href: normalizedHref,
      download: false,
    }
  }

  if (normalizedHref.startsWith(vendorAssetPrefix)) {
    return {
      href: normalizedHref,
      download: true,
    }
  }

  if (normalizedHref.startsWith('/')) {
    return {
      href: normalizedHref,
      download: false,
    }
  }

  const normalizedAssetPath = normalizedHref.replace(/^\.\//, '').replace(/^\//, '')

  return {
    href: `${vendorAssetPrefix}${normalizedAssetPath}`,
    download: true,
  }
}
