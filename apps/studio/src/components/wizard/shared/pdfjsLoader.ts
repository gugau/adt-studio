let pdfjsModule: Promise<typeof import("pdfjs-dist")> | null = null

/** Single dynamic import + worker setup so pdf work stays off the critical path until needed. */
export function getPdfJs() {
  if (!pdfjsModule) {
    pdfjsModule = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url,
      ).href
      return pdfjs
    })
  }
  return pdfjsModule
}
