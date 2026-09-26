import { describe, expect, it } from 'vitest'
import { resolveVendorLinkTarget } from './vendor_links'

describe('resolveVendorLinkTarget', () => {
  it('resolveVendorLinkTarget_ShouldKeepTheLinkWithoutDownload_WhenItIsExternal', () => {
    expect(resolveVendorLinkTarget('https://example.com/help')).toEqual({
      href: 'https://example.com/help',
      download: false,
    })
  })

  it('resolveVendorLinkTarget_ShouldFlagTheLinkForDownload_WhenItIsAnAbsoluteVendorAsset', () => {
    expect(resolveVendorLinkTarget('/api/cameras/vendor-assets/ceshi.ini')).toEqual({
      href: '/api/cameras/vendor-assets/ceshi.ini',
      download: true,
    })
  })

  it('resolveVendorLinkTarget_ShouldPointAtTheVendorAssetRoute_WhenTheLinkIsRelative', () => {
    expect(resolveVendorLinkTarget('./guides/activation.pdf')).toEqual({
      href: '/api/cameras/vendor-assets/guides/activation.pdf',
      download: true,
    })
  })
})
