import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { buildScreenshotHtml, type ScreenshotRenderer } from "@adt/pipeline"

export interface SectionScreenshotViewport {
  label: string
  width: number
  height: number
}

export interface SectionImageSource {
  getImageBase64(imageId: string): string
}

const IMG_DATA_ID_RE = /<img\s[^>]*data-id="([^"]+)"/g

export function resolveSectionImages(
  sectionHtml: string,
  source: SectionImageSource
): Map<string, { base64: string }> {
  const ids = new Set<string>()
  let m: RegExpExecArray | null
  IMG_DATA_ID_RE.lastIndex = 0
  while ((m = IMG_DATA_ID_RE.exec(sectionHtml)) !== null) {
    ids.add(m[1])
  }
  const images = new Map<string, { base64: string }>()
  for (const id of ids) {
    let base64: string | null = null
    try {
      base64 = source.getImageBase64(id)
    } catch {
      base64 = null
    }
    if (base64 != null) {
      images.set(id, { base64 })
    }
  }
  return images
}

export function sectionRenderCacheDir(bookDir: string): string {
  return path.join(bookDir, ".section-renders")
}

export function sectionScreenshotHash(
  viewport: SectionScreenshotViewport,
  screenshotHtml: string
): string {
  return crypto
    .createHash("sha256")
    .update(`${viewport.label}:${viewport.width}x${viewport.height}\n${screenshotHtml}`)
    .digest("hex")
    .slice(0, 16)
}

export async function prepareSectionScreenshot(opts: {
  bookDir: string
  label: string
  sectionHtml: string
  viewport: SectionScreenshotViewport
  images: SectionImageSource
  webAssetsDir: string
}): Promise<{ screenshotHtml: string; cachePath: string }> {
  const screenshotHtml = await buildScreenshotHtml({
    sectionHtml: opts.sectionHtml,
    label: opts.label,
    images: resolveSectionImages(opts.sectionHtml, opts.images),
    webAssetsDir: opts.webAssetsDir,
  })
  const hash = sectionScreenshotHash(opts.viewport, screenshotHtml)
  const cachePath = path.join(sectionRenderCacheDir(opts.bookDir), `${hash}.png`)
  return { screenshotHtml, cachePath }
}

export async function writeSectionScreenshot(opts: {
  renderer: ScreenshotRenderer
  screenshotHtml: string
  viewport: SectionScreenshotViewport
  cachePath: string
}): Promise<void> {
  fs.mkdirSync(path.dirname(opts.cachePath), { recursive: true })
  const base64 = await opts.renderer.screenshot(opts.screenshotHtml, {
    width: opts.viewport.width,
    height: opts.viewport.height,
  })
  fs.writeFileSync(opts.cachePath, Buffer.from(base64, "base64"))
}
