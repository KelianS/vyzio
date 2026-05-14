import { describe, expect, it } from 'vitest'
import { resolveVendorLinkTarget } from './vendorLinks'

describe('resolveVendorLinkTarget', () => {
  it('keeps external links in a separate page without download mode', () => {
    expect(resolveVendorLinkTarget('https://example.com/help')).toEqual({
      href: 'https://example.com/help',
      download: false,
    })
  })

  it('keeps absolute vendor asset links and flags them for download', () => {
    expect(resolveVendorLinkTarget('/api/cameras/vendor-assets/ceshi.ini')).toEqual({
      href: '/api/cameras/vendor-assets/ceshi.ini',
      download: true,
    })
  })

  it('rewrites relative asset links to the vendor asset route', () => {
    expect(resolveVendorLinkTarget('./guides/activation.pdf')).toEqual({
      href: '/api/cameras/vendor-assets/guides/activation.pdf',
      download: true,
    })
  })
})