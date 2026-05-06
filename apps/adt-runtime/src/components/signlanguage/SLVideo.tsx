import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { appConfigAtom } from "@/state/config.atoms"
import { signLanguageModeAtom } from "@/state/ui.atoms"
import { videoFilesAtom } from "@/state/language.atoms"
import { currentSectionIdAtom, currentPageNumberAtom, pagesAtom } from "@/state/nav.atoms"
import { currentLanguageAtom } from "@/state/language.atoms"

/**
 * Sign-language video overlay (replaces `#sign-language-video`). The video
 * file map is keyed `video-{pageIndex}` (legacy convention from
 * adt-preview.ts), so we resolve the current page's index against the pages
 * manifest to find the right file.
 */
export function SLVideo() {
  const features = useAtomValue(appConfigAtom).features
  const slMode = useAtomValue(signLanguageModeAtom)
  const videoFiles = useAtomValue(videoFilesAtom)
  const sectionId = useAtomValue(currentSectionIdAtom)
  const pageNumber = useAtomValue(currentPageNumberAtom)
  const pages = useAtomValue(pagesAtom)
  const lang = useAtomValue(currentLanguageAtom)

  const src = useMemo(() => {
    if (!features.signLanguage || !slMode) return null
    const idx =
      pageNumber ??
      (sectionId ? pages.findIndex((p) => p.section_id === sectionId) + 1 : 0)
    const filename = videoFiles[`video-${idx}`]
    if (!filename) return null
    return `./content/i18n/${lang}/video/${filename}`
  }, [features.signLanguage, slMode, videoFiles, sectionId, pageNumber, pages, lang])

  if (!src) return null

  return (
    <div className="fixed bottom-16 right-20 w-80 h-48 bg-black rounded-lg shadow-lg overflow-hidden z-[55]">
      <video src={src} autoPlay loop muted playsInline className="w-full h-full" />
    </div>
  )
}
