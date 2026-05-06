import { useAtomValue } from "jotai"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  resetVisibleAtom,
  retryHandlerAtom,
  submitVisibleAtom,
  validateHandlerAtom,
} from "@/state/activity.atoms"
import { useTranslation } from "@/hooks/useTranslation"

/**
 * Activity submit/reset bar — the right-aligned pair next to the page nav
 * controls in interface.html (`#submit-reset-container`). Activities push
 * their submit/reset handlers into the atoms; this component renders the
 * matching buttons when each is set.
 */
export function SubmitResetBar() {
  const submitVisible = useAtomValue(submitVisibleAtom)
  const resetVisible = useAtomValue(resetVisibleAtom)
  const validate = useAtomValue(validateHandlerAtom)
  const retry = useAtomValue(retryHandlerAtom)
  const { t } = useTranslation()

  if (!submitVisible && !resetVisible) return null

  return (
    <div className="fixed bottom-4 right-20 flex flex-row-reverse gap-2 z-[55]">
      {submitVisible && validate ? (
        <Button onClick={validate} size="lg" className="bg-blue-600 hover:bg-blue-700">
          {t("submit-text") || "Submit"}
        </Button>
      ) : null}
      {resetVisible && retry ? (
        <Button
          onClick={retry}
          variant="outline"
          size="icon"
          aria-label={t("reset-text") || "Reset"}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      ) : null}
    </div>
  )
}
