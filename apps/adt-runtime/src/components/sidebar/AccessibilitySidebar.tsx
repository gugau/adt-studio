import { useAtom, useAtomValue } from "jotai"
import { Accessibility } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  activeSidebarTabAtom,
  glossaryListOpenAtom,
  sidebarOpenAtom,
} from "@/state/ui.atoms"
import { AssistantTab } from "./AssistantTab"
import { SettingsTab } from "./SettingsTab"
import { GlossaryPanel } from "@/components/glossary/GlossaryPanel"
import { useTranslation } from "@/hooks/useTranslation"

/**
 * The legacy `<aside id="sidebar">` panel. Mounts as a right-aligned Sheet.
 *
 * Two top-level views, gated by `glossaryListOpenAtom`:
 *   - Default: Assistant / Settings tabs
 *   - Glossary: replaces the tabs entirely; back button restores default
 *
 * The trigger is the floating accessibility icon at the top-right of the
 * page (legacy `#open-sidebar`).
 */
export function AccessibilitySidebar() {
  const [open, setOpen] = useAtom(sidebarOpenAtom)
  const [tab, setTab] = useAtom(activeSidebarTabAtom)
  const glossaryListOpen = useAtomValue(glossaryListOpenAtom)
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("sidebar-title") || "Accessibility menu"}
          className="fixed top-2 right-4 w-12 h-12 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-blue-500 shadow-lg z-50"
        >
          <Accessibility className="w-7 h-7 text-gray-800" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[24rem] flex flex-col p-0"
        aria-describedby={undefined}
      >
        {glossaryListOpen ? (
          <>
            {/* Visually-hidden title satisfies Radix Dialog a11y requirement. */}
            <SheetHeader className="sr-only">
              <SheetTitle>{t("glossary-label") || "Glossary"}</SheetTitle>
            </SheetHeader>
            <GlossaryPanel />
          </>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6">
              <SheetTitle className="text-2xl text-center mt-4">
                {t("sidebar-title") || "Accessible AI"}
              </SheetTitle>
            </SheetHeader>
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "assistant" | "settings")}
              className="flex-1 mt-4 px-6 flex flex-col"
            >
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="assistant">
                  {t("sidebar-assistant") || "Assistant"}
                </TabsTrigger>
                <TabsTrigger value="settings">
                  {t("sidebar-settings") || "Settings"}
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="assistant"
                className="mt-4 overflow-y-auto pr-2 flex-1"
              >
                <AssistantTab />
              </TabsContent>
              <TabsContent
                value="settings"
                className="mt-4 overflow-y-auto pr-2 flex-1"
              >
                <SettingsTab />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
