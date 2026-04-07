import { isElectron } from "@/lib/utils"
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url"
import { installCollectionMethodPolyfills } from "@/lib/pdfjs-dist-polyfill"

let pdfjsModule: Promise<typeof import("pdfjs-dist")> | null = null

/** Single dynamic import + worker setup so pdf work stays off the critical path until needed. */
export function getPdfJs() {
  if (!pdfjsModule) {

    if (isElectron()) {
      installCollectionMethodPolyfills()
    }

    pdfjsModule = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      return pdfjs
    })
  }
  return pdfjsModule
}
