import { Fragment } from "react"
import { SettingsSection } from "@/features/settings/components/SettingsSection"
import { Kbd, KbdGroup } from "@/shared/ui/kbd"
import { useTranslation } from "@/features/language/hooks/useTranslation"
import { cn } from "@/shared/lib/utils"

interface ShortcutEntry {
  label: string
  /** One group per chord. Two groups render with the localized "then" word between them. */
  groups: string[][]
}

interface ShortcutRowProps {
  entry: ShortcutEntry
  thenLabel: string
  borderTop?: boolean
}

function ShortcutRow({ entry, thenLabel, borderTop }: ShortcutRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-3 gap-2",
        borderTop && "border-t border-border",
      )}
    >
      <span className="text-base font-medium text-foreground">
        {entry.label}
      </span>
      <span className="inline-flex items-center gap-2">
        {entry.groups.map((keys, groupIdx) => (
          <Fragment key={groupIdx}>
            {groupIdx > 0 ? (
              <span className="text-xs text-muted-foreground">{thenLabel}</span>
            ) : null}
            <KbdGroup>
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </Fragment>
        ))}
      </span>
    </div>
  )
}

export function KeyboardShortcutsSection() {
  const { t } = useTranslation()

  const thenLabel = t("shortcut-then") || "then"

  const entries: ShortcutEntry[] = [
    {
      label: t("shortcut-toc-label") || "Open table of contents",
      groups: [["X"]],
    },
    {
      label: t("shortcut-settings-label") || "Open settings",
      groups: [["A"]],
    },
    {
      label: t("shortcut-language-label") || "Open language",
      groups: [["L"]],
    },
    {
      label: t("shortcut-close-label") || "Close panel",
      groups: [["Esc"]],
    },
  ]

  return (
    <SettingsSection
      title={t("settings-section-shortcuts") || "Keyboard shortcuts"}
    >
      {entries.map((entry, idx) => (
        <ShortcutRow
          key={entry.label}
          entry={entry}
          thenLabel={thenLabel}
          borderTop={idx > 0}
        />
      ))}
    </SettingsSection>
  )
}
