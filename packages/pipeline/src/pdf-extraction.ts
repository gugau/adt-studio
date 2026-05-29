import fs from "node:fs"
import { extractPdfStream, type ExtractStreamResult } from "@adt/pdf"
import type { Storage } from "@adt/storage"
import type { Progress } from "./progress.js"
import { toBookMetadata } from "./metadata-model.js"

export interface ExtractOptions {
  pdfPath: string
  startPage?: number
  endPage?: number
  spreadMode?: boolean
  vectorTextGrouping?: boolean
  /** Whether the book renders fixed-layout. Gates the entire positioned-text
   *  extraction pipeline (stream-order recorder + paragraph parsing), which is
   *  consumed only by fixed-layout rendering, and enables the metric-based
   *  spacing cleanup. Reflowable books skip all of it. */
  fixedLayout?: boolean
}

export async function extractPDF(
  options: ExtractOptions,
  storage: Storage,
  progress: Progress
): Promise<void> {
  const { pdfPath, startPage, endPage, spreadMode, vectorTextGrouping, fixedLayout } = options

  progress.emit({ type: "step-start", step: "extract" })

  try {
    const pdfBuffer = fs.readFileSync(pdfPath)

    const { pdfMetadata, pages } = extractPdfStream(
      { pdfBuffer, startPage, endPage, spreadMode, vectorTextGrouping, fixedLayout },
      (p) => {
        progress.emit({
          type: "step-progress",
          step: "extract",
          message: `page ${p.page}/${p.totalPages}`,
          page: p.page,
          totalPages: p.totalPages,
        })
      }
    )

    storage.clearExtractedData()
    storage.putNodeData("metadata", "book", toBookMetadata(pdfMetadata))

    for await (const page of pages) {
      storage.putExtractedPage(page)
      // Store positioned text (paragraphs + viewport dims). Always available so
      // fixed-layout rendering doesn't need a separate pre-extraction step.
      storage.putNodeData("positioned-text", page.pageId, page.positionedText)
      // Store extraction debug info (grouping decisions, render method choices)
      if (page.extractionDebug) {
        storage.putNodeData("extraction-debug", page.pageId, page.extractionDebug)
      }
    }

    progress.emit({ type: "step-complete", step: "extract" })
  } catch (err) {
    progress.emit({
      type: "step-error",
      step: "extract",
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
