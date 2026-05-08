import { SettingsTab } from "@/components/sidebar/SettingsTab"
import { useTranslation } from "@/hooks/useTranslation"
import { DockContent } from "./DockLayout"

export function SettingsContent() {
  const { t } = useTranslation()

  return (
    <DockContent>
      <DockContent.Title>
        {t("sidebar-settings") || "Settings"}
      </DockContent.Title>
      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
        <SettingsTab />
      </div>
    </DockContent>
  )
}
