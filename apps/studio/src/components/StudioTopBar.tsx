import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { Home, HelpCircle, Settings } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { Button } from "@/components/ui/button"
import { LocaleSwitcher } from "@/components/LocaleSwitcher"
import { useSettingsDialog } from "@/routes/__root"

export type StudioTopBarProps = {
  /** When true, the brand row links to `/` with hover styles (e.g. add-book flow). */
  brandLinksHome?: boolean
  /** Optional title after `/` (e.g. translated “Add Book”). */
  trailingTitle?: ReactNode
}

export function StudioTopBar({ brandLinksHome = false, trailingTitle }: StudioTopBarProps) {
  const { t } = useLingui()
  const { openSettings } = useSettingsDialog()

  const brandInner = (
    <>
      <Home className="w-4 h-4 shrink-0" />
      <span className="text-sm font-semibold">ADT Studio</span>
    </>
  )

  const brandRow = brandLinksHome ? (
    <Link
      to="/"
      className="flex items-center gap-2.5 hover:bg-gray-600 -ml-2 px-2 h-10 transition-colors"
      title={t`Back to books`}
    >
      {brandInner}
    </Link>
  ) : (
    <div className="flex items-center gap-2.5">{brandInner}</div>
  )

  return (
    <div className="shrink-0 min-h-11 py-1 flex items-center bg-gray-700 text-white px-4">
      <div className="flex items-center min-w-0">
        {brandRow}
        {trailingTitle != null && (
          <>
            <span className="text-white/40 text-sm mx-2">/</span>
            <span className="text-sm font-semibold">{trailingTitle}</span>
          </>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-white/70 hover:text-white hover:bg-gray-600"
          title={t`How it works`}
          asChild
        >
          <Link to="/onboarding">
            <HelpCircle className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <LocaleSwitcher />
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-white/70 hover:text-white hover:bg-gray-600"
          onClick={openSettings}
          title={t`API Key Settings`}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
