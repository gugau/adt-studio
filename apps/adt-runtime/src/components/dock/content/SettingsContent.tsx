import { SettingsTab } from "@/components/sidebar/SettingsTab"
import { useTranslation } from "@/hooks/useTranslation"

/**
 * Wraps the existing `SettingsTab` so it sits inside a NavigationMenu
 * Content slot with a constrained box and a header.
 */
export function SettingsContent() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col w-[var(--dock-width,32rem)] max-w-[calc(100vw-2rem)] h-[28rem]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold">
          {t("sidebar-settings") || "Settings"}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable] px-4 py-3">
        <SettingsTab />
      </div>
    </div>
  )
}
