import { Trans } from "@lingui/react/macro"
import { useRightSidebarState } from "./RightSidebarContext"

export function RightSidebar() {
  const { header } = useRightSidebarState()

  return (
    <aside className="w-[320px] shrink-0 border-l bg-background flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-3 border-b">
        {header ?? (
          <div className="py-2">
            <p className="text-sm font-medium">
              <Trans>No selection</Trans>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <Trans>Select an item to see details and actions</Trans>
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0" />
    </aside>
  )
}

