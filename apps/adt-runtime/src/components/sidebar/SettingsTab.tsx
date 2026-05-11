import { useAtom, useAtomValue } from "jotai"
import { ToggleRow } from "./ToggleRow"
import { SegmentedRow } from "./SegmentedRow"
import { SettingsSection } from "./SettingsSection"
import { DockLayoutPicker } from "./DockLayoutPicker"
import { appConfigAtom } from "@/state/config.atoms"
import {
  autoplayModeAtom,
  describeImagesModeAtom,
  readAloudModeAtom,
} from "@/state/audio.atoms"
import {
  iconSizeAtom,
  reduceMotionAtom,
  stateModeAtom,
  type IconSize,
} from "@/state/ui.atoms"
import { useTranslation } from "@/hooks/useTranslation"
import { trackToggleEvent } from "@/lib/analytics"

export function SettingsTab() {
  const { t } = useTranslation()
  const features = useAtomValue(appConfigAtom).features
  const [stateMode, setStateMode] = useAtom(stateModeAtom)
  const [readAloud, setReadAloud] = useAtom(readAloudModeAtom)
  const [autoplay, setAutoplay] = useAtom(autoplayModeAtom)
  const [describeImages, setDescribeImages] = useAtom(describeImagesModeAtom)
  const [iconSize, setIconSize] = useAtom(iconSizeAtom)
  const [reduceMotion, setReduceMotion] = useAtom(reduceMotionAtom)

  const wrap = (name: string, setter: (v: boolean) => void) => (next: boolean) => {
    trackToggleEvent(name, next)
    setter(next)
  }

  const showReadingSection = features.readAloud
  const showTtsSubsettings =
    readAloud && (features.autoplay || features.describeImages)

  return (
    <div className="flex flex-col gap-1 px-4 pb-6">
      {showReadingSection ? (
        <SettingsSection title={t("settings-section-reading") || "Reading"}>
          <ToggleRow
            label={t("tts-label") || "Text to speech"}
            checked={readAloud}
            onChange={wrap("ReadAloud", setReadAloud)}
          />
          {showTtsSubsettings ? (
            <>
              {features.autoplay ? (
                <ToggleRow
                  label={t("autoplay-label") || "Autoplay"}
                  checked={autoplay}
                  onChange={wrap("Autoplay", setAutoplay)}
                />
              ) : null}
              {features.describeImages ? (
                <ToggleRow
                  label={t("describe-images-label") || "Describe images"}
                  checked={describeImages}
                  onChange={wrap("DescribeImages", setDescribeImages)}
                />
              ) : null}
            </>
          ) : null}
        </SettingsSection>
      ) : null}

      <SettingsSection
        title={t("settings-section-toolbar") || "Toolbar"}
        description={
          t("settings-section-toolbar-hint") ||
          "Click the preview to choose where the toolbar sits."
        }
      >
        <div className="py-3">
          <DockLayoutPicker />
        </div>
      </SettingsSection>

      <SettingsSection title={t("settings-section-accessibility") || "Accessibility"}>
        <SegmentedRow<IconSize>
          label={t("icon-size-label") || "Icon size"}
          value={iconSize as IconSize}
          onChange={(v) => {
            trackToggleEvent(`IconSize:${v}`, true)
            setIconSize(v)
          }}
          options={[
            { value: "sm", label: t("icon-size-sm") || "Small" },
            { value: "md", label: t("icon-size-md") || "Medium" },
            { value: "lg", label: t("icon-size-lg") || "Large" },
          ]}
        />
        <ToggleRow
          label={t("reduce-motion-label") || "Reduce motion"}
          description={
            t("reduce-motion-description") ||
            "Disable animations and transitions across the reader."
          }
          checked={reduceMotion}
          onChange={(v) => {
            trackToggleEvent("ReduceMotion", v)
            setReduceMotion(v)
          }}
        />
      </SettingsSection>

      {features.showAutoHideButton !== false ? (
        <SettingsSection title={t("settings-section-behavior") || "Behavior"}>
          <ToggleRow
            label={t("state-label") || "Auto-hide menus"}
            checked={stateMode}
            onChange={(v) => {
              trackToggleEvent("HideMenus", v)
              setStateMode(v)
            }}
          />
        </SettingsSection>
      ) : null}
    </div>
  )
}
