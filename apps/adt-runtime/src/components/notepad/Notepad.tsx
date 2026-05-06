import { useAtom, useAtomValue } from "jotai"
import { Pencil, Save } from "lucide-react"
import { useEffect, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { appConfigAtom } from "@/state/config.atoms"
import { notepadOpenAtom } from "@/state/ui.atoms"
import { useTranslation } from "@/hooks/useTranslation"

const STORAGE_KEY = "notepad-content"

/**
 * Replaces `#notepad-button` + `#notepad-content`. Notes are persisted to
 * localStorage under `notepad-content`, matching the legacy notepad.js key
 * so users keep their notes across the migration.
 */
export function Notepad() {
  const features = useAtomValue(appConfigAtom).features
  const [open, setOpen] = useAtom(notepadOpenAtom)
  const [text, setText] = useState("")
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (typeof localStorage === "undefined") return
    setText(localStorage.getItem(STORAGE_KEY) ?? "")
  }, [])

  if (!features.notepad) return null

  const save = () => {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, text)
    setSavedAt(Date.now())
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t("notepad-open-label") || "Open notepad"}
            className="fixed bottom-52 right-4 w-12 h-12 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-blue-500 shadow-lg transition-all duration-200 z-[55]"
          >
            <Pencil className="w-5 h-5 text-gray-700" />
          </button>
        }
      />
      <PopoverContent side="left" className="w-96">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-600" />
            {t("notepad-label") || "Notepad"}
          </h3>
          <Button onClick={save} size="sm" variant="outline" aria-label={t("notepad-save-button") || "Save"}>
            <Save className="w-4 h-4 mr-1" />
            {t("notepad-save-text") || "Save"}
          </Button>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("notepad-placeholder") || "Write your notes here..."}
          className="min-h-[14rem]"
        />
        {savedAt ? (
          <p className="mt-2 text-sm text-green-600">
            {t("notepad-saved-message") || "Saved"}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
