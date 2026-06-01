import { ScrollArea } from "@/shared/ui/scroll-area"
import { SettingsTab } from "@/features/settings/components/SettingsTab"
import { useTranslation } from "@/features/language/hooks/useTranslation"
import { DockContent } from "@/features/dock/components/DockLayout"

export function SettingsContent() {
  const { t } = useTranslation()

  return (
    <DockContent>
      <DockContent.Title>
        {t("sidebar-settings") || "Settings"}
      </DockContent.Title>
      <ScrollArea className="flex-1 min-h-0">
        <SettingsTab />
      </ScrollArea>
    </DockContent>
  )
}
