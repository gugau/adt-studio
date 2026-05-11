import { useAtom, useAtomValue } from "jotai"
import { ToggleRow } from "./ToggleRow"
import { SegmentedRow } from "./SegmentedRow"
import { LanguageSelect } from "./LanguageSelect"
import { appConfigAtom } from "@/state/config.atoms"
import {
  autoplayModeAtom,
  describeImagesModeAtom,
  readAloudModeAtom,
} from "@/state/audio.atoms"
import {
  dockAlignAtom,
  dockPositionAtom,
  dockWidthAtom,
  stateModeAtom,
  type DockAlign,
  type DockPosition,
  type DockWidth,
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
  const [dockWidth, setDockWidth] = useAtom(dockWidthAtom)
  const [dockPosition, setDockPosition] = useAtom(dockPositionAtom)
  const [dockAlign, setDockAlign] = useAtom(dockAlignAtom)

  const wrap = (name: string, setter: (v: boolean) => void) => (next: boolean) => {
    trackToggleEvent(name, next)
    setter(next)
  }

  const showTtsSubsettings =
    readAloud && (features.autoplay || features.describeImages)

  return (
    <div className="flex flex-col">
      <LanguageSelect />

      {features.readAloud ? (
        <>
          <ToggleRow
            label={t("tts-label") || "Text to speech"}
            checked={readAloud}
            onChange={wrap("ReadAloud", setReadAloud)}
            borderTop
          />
          {showTtsSubsettings ? (
            <div className="bg-gray-50 rounded-lg border border-gray-200 mt-2 px-3">
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
                  borderTop={Boolean(features.autoplay)}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      <SegmentedRow<DockWidth>
        label={t("dock-width-label") || "Width"}
        value={dockWidth as DockWidth}
        onChange={(v) => {
          trackToggleEvent(`DockWidth:${v}`, true)
          setDockWidth(v)
        }}
        options={[
          { value: "full", label: t("dock-width-full") || "Full" },
          { value: "compact", label: t("dock-width-compact") || "Compact" },
        ]}
        borderTop
      />

      <SegmentedRow<DockPosition>
        label={t("dock-position-label") || "Dock position"}
        value={dockPosition as DockPosition}
        onChange={(v) => {
          trackToggleEvent(`DockPosition:${v}`, true)
          setDockPosition(v)
        }}
        options={[
          { value: "top", label: t("dock-position-top") || "Top" },
          { value: "bottom", label: t("dock-position-bottom") || "Bottom" },
        ]}
        borderTop
      />

      <SegmentedRow<DockAlign>
        label={t("dock-align-label") || "Alignment"}
        value={dockAlign as DockAlign}
        onChange={(v) => {
          trackToggleEvent(`DockAlign:${v}`, true)
          setDockAlign(v)
        }}
        options={[
          { value: "left", label: t("dock-align-left") || "Left" },
          { value: "center", label: t("dock-align-center") || "Center" },
        ]}
        borderTop
      />

      {features.showAutoHideButton !== false ? (
        <ToggleRow
          label={t("state-label") || "Auto-hide menus"}
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
