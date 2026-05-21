import { useAtom } from "jotai"
import { Settings } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { adminPopupOpenAtom } from "@/shared/state/ui.atoms"
import { useTranslation } from "@/features/language/hooks/useTranslation"

/**
 * Stub for the admin popup. Legacy admin_popup.js exposed maintenance flows
 * (cache reset, force re-fetch, etc.). To be ported in a follow-up — this
 * stub keeps the trigger surface available so keyboard shortcuts that toggle
 * `adminPopupOpenAtom` still produce a dialog.
 */
export function AdminPopup() {
  const [open, setOpen] = useAtom(adminPopupOpenAtom)
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {t("admin-popup-title") || "Admin"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("admin-popup-stub-message") || "Admin tools will be ported in a follow-up."}
        </p>
      </DialogContent>
    </Dialog>
  )
}
