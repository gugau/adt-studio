import type { ImageFilters, ImageClassificationOutput, AppConfig } from "@adt/types"
import type { ImageData } from "@adt/storage"
import { grayscaleStdDev } from "./image-complexity.js"

export interface ImageClassifyConfig {
  filters: ImageFilters
  getImageBytes?: (imageId: string) => Buffer
}

/**
 * Classify images on a single page. Pure function — no side effects.
 * Filters images by size constraints, pixel complexity, and prunes full-page renders.
 */
export function classifyPageImages(
  pageId: string,
  images: ImageData[],
  config: ImageClassifyConfig
): ImageClassificationOutput {
  const { min_side, max_side, min_stddev } = config.filters

  // When a spread-stitched image exists, identify the original halves to prune.
  // Spread images have IDs ending in "_spread" and are derived from the two
  // largest images (one from each page in a two-page spread).
  const hasSpread = images.some((img) => img.imageId.endsWith("_spread"))
  let spreadSourceIds: Set<string> | null = null
  if (hasSpread) {
    // The original halves are the two largest non-spread, non-page images
    const candidates = images
      .filter((img) => !img.imageId.endsWith("_spread") && img.imageId !== `${pageId}_page`)
      .sort((a, b) => b.width * b.height - a.width * a.height)
    if (candidates.length >= 2) {
      spreadSourceIds = new Set([candidates[0].imageId, candidates[1].imageId])
    }
  }

  return {
    images: images.map((img) => {
      // Full-page renders are always pruned
      if (img.imageId === `${pageId}_page`) {
        return { imageId: img.imageId, isPruned: true, reason: "full-page render" }
      }

      // Original halves are pruned when a stitched spread exists
      if (spreadSourceIds?.has(img.imageId)) {
        return { imageId: img.imageId, isPruned: true, reason: "replaced by spread-stitched image" }
      }

      const shortSide = Math.min(img.width, img.height)
      const longSide = Math.max(img.width, img.height)

      if (min_side !== undefined && shortSide < min_side) {
        return {
          imageId: img.imageId,
          isPruned: true,
          reason: `shortest side ${shortSide}px < min_side ${min_side}px`,
        }
      }

      if (max_side !== undefined && longSide > max_side) {
        return {
          imageId: img.imageId,
          isPruned: true,
          reason: `longest side ${longSide}px > max_side ${max_side}px`,
        }
      }

      // Complexity filter — runs after size filters (more expensive, needs pixel data)
      if (min_stddev !== undefined && config.getImageBytes) {
        const imageBytes = config.getImageBytes(img.imageId)
        const stddev = grayscaleStdDev(imageBytes)
        if (stddev < min_stddev) {
          return {
            imageId: img.imageId,
            isPruned: true,
            reason: `stddev ${stddev.toFixed(1)} < min_stddev ${min_stddev}`,
          }
        }
      }

      return { imageId: img.imageId, isPruned: false }
    }),
  }
}

/**
 * Build ImageClassifyConfig from AppConfig.
 */
export function buildImageClassifyConfig(appConfig: AppConfig): ImageClassifyConfig {
  return {
    filters: appConfig.image_filters ?? {},
  }
}
