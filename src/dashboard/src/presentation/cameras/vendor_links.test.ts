import { describe, expect, it } from 'vitest'
import { resolveVendorLinkTarget } from './vendor_links'

describe('resolveVendorLinkTarget', () => {
  it('resolveVendorLinkTarget_ShouldKeepTheLinkWithoutDownload_WhenItIsExternal', () => {
    // Arrange & Act
    const target = resolveVendorLinkTarget('https://example.com/help')

    // Assert
    expect(target).toEqual({
      href: 'https://example.com/help',
      download: false,
    })
  })

  it('resolveVendorLinkTarget_ShouldFlagTheLinkForDownload_WhenItIsAnAbsoluteVendorAsset', () => {
    // Arrange & Act
    const target = resolveVendorLinkTarget('/api/cameras/vendor-assets/ceshi.ini')

    // Assert
    expect(target).toEqual({
      href: '/api/cameras/vendor-assets/ceshi.ini',
      download: true,
    })
  })

  it('resolveVendorLinkTarget_ShouldPointAtTheVendorAssetRoute_WhenTheLinkIsRelative', () => {
    // Arrange & Act
    const target = resolveVendorLinkTarget('./guides/activation.pdf')

    // Assert
    expect(target).toEqual({
      href: '/api/cameras/vendor-assets/guides/activation.pdf',
      download: true,
    })
  })
})
