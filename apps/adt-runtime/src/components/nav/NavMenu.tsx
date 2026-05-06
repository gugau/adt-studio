import { useAtom, useAtomValue } from "jotai"
import { List } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { navOpenAtom } from "@/state/ui.atoms"
import { currentSectionIdAtom, pagesAtom, tocAtom } from "@/state/nav.atoms"
import { appConfigAtom } from "@/state/config.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"

/**
 * Replaces `#nav-popup` (the hamburger button) and the legacy nav fragment
 * that was injected from `nav.html`. Renders the TOC if present, falling
 * back to the flat `pages.json` list. Selecting a page triggers a real
 * navigation to its HTML file.
 */
export function NavMenu() {
  const features = useAtomValue(appConfigAtom).features
  const [open, setOpen] = useAtom(navOpenAtom)
  const toc = useAtomValue(tocAtom)
  const pages = useAtomValue(pagesAtom)
  const currentSectionId = useAtomValue(currentSectionIdAtom)
  const { t } = useTranslation()

  if (!features.showNavigationControls) return null

  const entries =
    toc.length > 0
      ? toc
      : pages.map((p) => ({
          section_id: p.section_id,
          href: p.href,
          title: p.section_id,
          chapter_id: p.section_id,
          level: undefined as number | undefined,
        }))

  const go = (href: string) => {
    setOpen(false)
    window.location.href = href
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("nav-label") || "Navigation menu"}
          className="fixed bottom-3 right-3 px-4 py-2 bg-white text-gray-800 rounded-lg shadow-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 z-[60]"
        >
          <List className="w-5 h-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle>{t("nav-label") || "Contents"}</SheetTitle>
        </SheetHeader>
        <ul className="mt-6 space-y-1 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {entries.map((entry) => {
            const active = entry.section_id === currentSectionId
            return (
              <li key={entry.section_id}>
                <button
                  type="button"
                  onClick={() => go(entry.href)}
                  className={cn(
                    "w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors",
                    active && "bg-accent font-medium",
                    entry.level === 2 && "pl-6",
                    entry.level === 3 && "pl-9",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {entry.title}
                </button>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
