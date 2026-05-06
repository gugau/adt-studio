import { useAtom, useAtomValue } from "jotai"
import { ToggleRow } from "./ToggleRow"
import { LanguageSelect } from "./LanguageSelect"
import { appConfigAtom } from "@/state/config.atoms"
import { stateModeAtom } from "@/state/ui.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { trackToggleEvent } from "@/lib/analytics"

/**
 * Settings tab — language picker + chrome auto-hide toggle.
 * Character profile / username row is intentionally deferred to the
 * character-display follow-up (see tutorial.js / character-display.js).
 */
export function SettingsTab() {
  const { t } = useTranslation()
  const features = useAtomValue(appConfigAtom).features
  const [stateMode, setStateMode] = useAtom(stateModeAtom)

  return (
    <div className="flex flex-col">
      <LanguageSelect />
      {features.showAutoHideButton !== false ? (
        <ToggleRow
          label={t("state-label") || "Hide menus"}
          checked={stateMode}
          onChange={(v) => {
            trackToggleEvent("HideMenus", v)
            setStateMode(v)
          }}
          borderTop
        />
      ) : null}
    </div>
  )
}
