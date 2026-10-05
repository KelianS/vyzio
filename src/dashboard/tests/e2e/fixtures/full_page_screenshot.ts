import type { Page, PageScreenshotOptions } from '@playwright/test'

/** A full-page shot with the sticky bars released, so the header stays at the top (capture only). */
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
