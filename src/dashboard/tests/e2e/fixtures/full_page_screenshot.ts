import type { Page, PageScreenshotOptions } from '@playwright/test'

/**
 * A whole-page screenshot laid out from the top. A full-page capture draws a sticky bar where the
 * scroll left it, so the header lands mid-image; the capture alone releases the bars, never the product.
 */
export async function fullPageScreenshot(
  page: Page,
  options: Pick<PageScreenshotOptions, 'path' | 'quality'>,
) {
  await page.evaluate(() => window.scrollTo(0, 0))
  // `sticky` is the Tailwind class every sticky bar carries (header, draft bar).
  const release = await page.addStyleTag({ content: '.sticky { position: static !important; }' })
  await page.screenshot({ ...options, fullPage: true })
  await release.evaluate((style) => style.parentNode?.removeChild(style))
}
