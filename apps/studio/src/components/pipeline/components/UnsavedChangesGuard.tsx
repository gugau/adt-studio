import { useBlocker } from "@tanstack/react-router"
import { Trans } from "@lingui/react/macro"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useHasUnsavedChanges } from "./floating-save"

/**
 * Warns before leaving a view that has unsaved changes — both on in-app
 * navigation (stage/page/book switches, which otherwise silently drop pending
 * edits) and on tab close/reload. Reads the shared floating-save registry, so
 * it must be rendered inside a FloatingSaveProvider and under the router.
 */
export function UnsavedChangesGuard() {
  const hasUnsaved = useHasUnsavedChanges()

  const { status, proceed, reset } = useBlocker({
    shouldBlockFn: () => hasUnsaved,
    enableBeforeUnload: () => hasUnsaved,
    withResolver: true,
  })

  return (
    <AlertDialog
      open={status === "blocked"}
      onOpenChange={(open) => {
        // Escape / dismiss keeps the user on the page.
        if (!open) reset?.()
      }}
    >
      <AlertDialogContent className="[--tw-enter-translate-x:0]! [--tw-enter-translate-y:0]! [--tw-exit-translate-x:0]! [--tw-exit-translate-y:0]!">
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>Discard unsaved changes?</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>
              You have unsaved changes that will be lost if you leave. Save them
              first, or leave to discard.
            </Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Cancel routes through onOpenChange -> reset (also handles Escape). */}
          <AlertDialogCancel>
            <Trans>Stay</Trans>
          </AlertDialogCancel>
          <Button variant="destructive" onClick={() => proceed?.()}>
            <Trans>Leave</Trans>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
